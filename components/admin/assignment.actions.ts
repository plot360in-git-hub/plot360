'use server';

import { createClient } from '@/lib/supabase/server';
import { isCurrentUserAdmin } from './admin.actions';
import { assignAgentToProperty } from './monitoring.actions';
import { getVerifiedAgentsExcludingBanned, getBannedAgentIds } from './agent-bans.actions';
import { getOrCreateUploadToken } from '@/components/agent/magic-link.actions';
import { logAdminAction } from './timeline.actions';
import { logWhatsAppMessage } from './whatsapp-log.actions';

// Redesign 2026-09 — admin console, "Job assignment" queue + Assign
// screen (design_handoff_plot360_redesign, "Plot360 Admin.dc.html").
//
// Two assignment origins now exist side by side:
//  - "legacy": the pre-redesign subscription/due-date model
//    (components/admin/monitoring.actions.ts, getEligiblePropertiesFor
//    Assignment / assignAgentToProperty) — untouched, reused as-is.
//  - "visit_request": the redesign's customer self-service scheduling
//    (visit_requests, created by components/payments/visitCredits.
//    actions.ts's requestVisit) — turning an open one into a real
//    monitoring_jobs row was explicitly left as admin-console follow-up
//    work (see ARCHITECTURE.md §9) and is implemented here.
// A third kind, "stuck", covers a job already assigned to an agent who
// dropped it or couldn't finish in time — the design's own queue states
// list includes "Reassignment needed" as a state WITHIN Job assignment,
// not a separate screen, so a long-open assigned/accepted job reappears
// here for reassignment rather than needing the old, now-unreferenced
// MonitoringOverview.tsx's separate "Active assignments" list.
export type AssignmentTarget =
  | {
      kind: 'legacy';
      id: string; // property id
      propertyId: string;
      propertyName: string;
      address: string;
      sroName: string | null;
      sroCode: string | null;
      window: string | null;
    }
  | {
      kind: 'visit_request';
      id: string; // visit_request id
      propertyId: string;
      propertyName: string;
      address: string;
      sroName: string | null;
      sroCode: string | null;
      window: string | null;
      windowStart: string;
      windowEnd: string;
      visitCreditId: string | null;
    }
  | {
      kind: 'stuck';
      id: string; // monitoring_jobs id
      jobId: string;
      propertyId: string;
      propertyName: string;
      address: string;
      sroName: string | null;
      sroCode: string | null;
      window: string | null;
      currentAgentId: string | null;
    };

const STUCK_DAYS = 7;

function addressOf(p: any) {
  return [p.street_address, p.village_town, p.district, p.state].filter(Boolean).join(', ');
}

export async function getLegacyAssignmentTargets() {
  const { getEligiblePropertiesForAssignment } = await import('./monitoring.actions');
  const properties = await getEligiblePropertiesForAssignment();
  return properties.map((p: any) => ({
    kind: 'legacy' as const,
    id: p.id,
    propertyId: p.id,
    propertyName: p.property_name,
    address: addressOf(p),
    sroName: p.sro_name,
    sroCode: p.sro_code,
    window: null,
    dueDate: p.next_monitoring_due_date,
    // See getEligiblePropertiesForAssignment (monitoring.actions.ts) —
    // the real "waiting since" timestamp for a first-visit target, which
    // has no due date to measure lateness/wait against otherwise.
    eligibleSince: p.eligible_since ?? null,
  }));
}

export async function getVisitRequestAssignmentTargets() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visit_requests')
    .select(
      'id, property_id, requested_window_start, requested_window_end, visit_credit_id, created_at, properties(property_name, street_address, village_town, district, state, sro_name, sro_code)'
    )
    .eq('status', 'open')
    .order('requested_window_start', { ascending: true });

  return (data ?? []).map((r: any) => ({
    kind: 'visit_request' as const,
    id: r.id,
    propertyId: r.property_id,
    propertyName: r.properties?.property_name,
    address: addressOf(r.properties ?? {}),
    sroName: r.properties?.sro_name,
    sroCode: r.properties?.sro_code,
    window: `${r.requested_window_start?.slice(5)}–${r.requested_window_end?.slice(5)}`,
    windowStart: r.requested_window_start,
    windowEnd: r.requested_window_end,
    visitCreditId: r.visit_credit_id,
    createdAt: r.created_at,
  }));
}

// Jobs already assigned to an agent who dropped it, couldn't finish in
// time, or explicitly rejected it. Matches the same "in progress" window
// reassignMonitoringJob() itself enforces (assigned/accepted/rejected —
// not submitted or approved, since that work shouldn't be discarded).
// A "rejected" job (the agent explicitly declined) is always urgent; an
// assigned/accepted one is stuck once it's past its requested window or
// has simply sat unsubmitted for STUCK_DAYS.
export async function getStuckAssignmentTargets() {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - STUCK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select(
      'id, agent_id, status, assigned_at, requested_window_end, property_id, properties(property_name, street_address, village_town, district, state, sro_name, sro_code)'
    )
    .in('status', ['assigned', 'accepted', 'rejected'])
    .order('assigned_at', { ascending: true });

  const now = Date.now();
  return (data ?? [])
    .filter((j: any) => {
      if (j.status === 'rejected') return true;
      const stale = j.assigned_at && j.assigned_at < cutoff;
      const pastWindow = j.requested_window_end && new Date(j.requested_window_end).getTime() < now;
      return stale || pastWindow;
    })
    .map((j: any) => ({
      kind: 'stuck' as const,
      id: j.id,
      jobId: j.id,
      propertyId: j.property_id,
      propertyName: j.properties?.property_name,
      address: addressOf(j.properties ?? {}),
      sroName: j.properties?.sro_name,
      sroCode: j.properties?.sro_code,
      window: j.status === 'rejected' ? 'agent declined' : j.requested_window_end ? `overdue since ${String(j.requested_window_end).slice(5)}` : `assigned ${String(j.assigned_at).slice(0, 10)}`,
      currentAgentId: j.agent_id,
      assignedAt: j.assigned_at,
    }));
}

export async function getAssignmentTarget(kind: 'legacy' | 'visit_request' | 'stuck', id: string): Promise<AssignmentTarget | null> {
  if (kind === 'legacy') {
    const targets = await getLegacyAssignmentTargets();
    return (targets.find((t) => t.id === id) as AssignmentTarget) ?? null;
  }
  if (kind === 'stuck') {
    const targets = await getStuckAssignmentTargets();
    return (targets.find((t) => t.id === id) as AssignmentTarget) ?? null;
  }
  const targets = await getVisitRequestAssignmentTargets();
  return (targets.find((t) => t.id === id) as AssignmentTarget) ?? null;
}

// Ranked "Suggested — SRO matches NNNN" list: verified, non-banned
// agents whose sro_code matches the property's, ranked by fewest
// currently-open jobs (least loaded first), ties broken by more
// completed visits (more experienced). No such ranking existed before
// this phase — getVerifiedAgentsList() returned an unranked, unfiltered
// list.
export async function getSuggestedAgents(sroCode: string | null) {
  if (!sroCode) return [];
  const supabase = await createClient();
  const banned = await getBannedAgentIds();

  const { data: agents } = await supabase
    .from('agent_profiles')
    .select('id, sro_name, sro_code, profiles(first_name, last_name, email)')
    .eq('status', 'verified')
    .eq('sro_code', sroCode);
  const matching = (agents ?? []).filter((a) => !banned.has(a.id));
  if (matching.length === 0) return [];

  const agentIds = matching.map((a) => a.id);
  const [{ data: openJobs }, { data: doneJobs }] = await Promise.all([
    supabase.from('monitoring_jobs').select('agent_id').in('agent_id', agentIds).in('status', ['assigned', 'accepted', 'submitted']),
    supabase.from('monitoring_jobs').select('agent_id').in('agent_id', agentIds).eq('status', 'approved'),
  ]);
  const openCount: Record<string, number> = {};
  for (const j of openJobs ?? []) openCount[j.agent_id] = (openCount[j.agent_id] ?? 0) + 1;
  const doneCount: Record<string, number> = {};
  for (const j of doneJobs ?? []) doneCount[j.agent_id] = (doneCount[j.agent_id] ?? 0) + 1;

  return matching
    .map((a) => ({ ...a, openJobs: openCount[a.id] ?? 0, completedVisits: doneCount[a.id] ?? 0 }))
    .sort((a, b) => a.openJobs - b.openJobs || b.completedVisits - a.completedVisits);
}

// "All agents — manual override": every verified, non-banned agent,
// noting whether their SRO matches the target property. "Assigning
// outside the SRO is allowed and recorded" per the design.
export async function getAllAgentsForOverride(sroCode: string | null, query?: string) {
  const agents = await getVerifiedAgentsExcludingBanned();
  const q = (query ?? '').trim().toLowerCase();
  return agents
    .filter((a: any) => {
      if (!q) return true;
      const name = `${a.profiles?.first_name ?? ''} ${a.profiles?.last_name ?? ''} ${a.sro_name ?? ''} ${a.sro_code ?? ''}`.toLowerCase();
      return name.includes(q);
    })
    .map((a: any) => ({ ...a, sroMatches: !!sroCode && a.sro_code === sroCode }));
}

// Dispatches to the right assignment path and, either way, logs the
// internal timeline entry + WhatsApp outbox row the design's Assign
// screen shows.
export async function assignAgentToTarget(kind: 'legacy' | 'visit_request' | 'stuck', id: string, agentId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  let jobId: string;
  let propertyId: string;

  if (kind === 'legacy') {
    const result = await assignAgentToProperty(id, agentId);
    if ('error' in result) return result;
    jobId = result.jobId!;
    propertyId = id;
  } else if (kind === 'stuck') {
    const { reassignMonitoringJob } = await import('./monitoring.actions');
    const { data: existingJob } = await supabase.from('monitoring_jobs').select('property_id').eq('id', id).single();
    if (!existingJob) return { error: 'Job not found.' };
    const result = await reassignMonitoringJob(id, agentId);
    if ('error' in result) return result;
    jobId = id;
    propertyId = existingJob.property_id;
  } else {
    const { data: visitRequest } = await supabase
      .from('visit_requests')
      .select('id, property_id, requested_window_start, requested_window_end, visit_credit_id, status')
      .eq('id', id)
      .single();
    if (!visitRequest) return { error: 'Visit request not found.' };
    if (visitRequest.status !== 'open') return { error: 'This visit request is no longer open.' };

    const { data: userData } = await supabase.auth.getUser();
    const { count: priorVisits } = await supabase
      .from('monitoring_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', visitRequest.property_id);

    const { data: job, error: jobError } = await supabase
      .from('monitoring_jobs')
      .insert({
        property_id: visitRequest.property_id,
        agent_id: agentId,
        assigned_by: userData.user?.id,
        status: 'assigned',
        visit_number: (priorVisits ?? 0) + 1,
        requested_window_start: visitRequest.requested_window_start,
        requested_window_end: visitRequest.requested_window_end,
        visit_credit_id: visitRequest.visit_credit_id,
      })
      .select('id')
      .single();
    if (jobError) return { error: jobError.message };

    const { error: vrError } = await supabase
      .from('visit_requests')
      .update({ status: 'assigned', monitoring_job_id: job.id })
      .eq('id', id);
    if (vrError) return { error: vrError.message };

    jobId = job.id;
    propertyId = visitRequest.property_id;
  }

  const { data: property } = await supabase
    .from('properties')
    .select('property_name, plot_size, plot_size_unit, street_address, village_town, district, state, google_map_lat, google_map_lng, plot_gps_coordinate, near_by_landmark')
    .eq('id', propertyId)
    .single();
  const { data: job } = await supabase
    .from('monitoring_jobs')
    .select('agent_profiles(profiles(phone_country_code, phone_number))')
    .eq('id', jobId)
    .single();

  const tokenResult = await getOrCreateUploadToken(jobId);
  const agentProfile: any = job?.agent_profiles;
  const phoneCountryCode = agentProfile?.profiles?.phone_country_code ?? null;
  const phoneNumber = agentProfile?.profiles?.phone_number ?? null;
  const phone = agentProfile?.profiles ? `${phoneCountryCode ?? ''}${phoneNumber ?? ''}` : '';

  // Redesign 2026-09 (follow-up) — Plot: "check ... any other place
  // where whatsapp is not opening and just logging internally ... and
  // fix it." This used to only log the assignment message; nothing ever
  // opened WhatsApp for the admin to actually send it. Now returns the
  // phone/message too so AssignAgentButtons.tsx can show a "Send via
  // WhatsApp" link, same shape AssignAgentForm.tsx/ReassignAgentForm.tsx
  // already use for the "legacy"-flow equivalent of this same action.
  let message: string | null = null;
  if (property && !('error' in tokenResult) && phone) {
    const uploadLink = `${process.env.NEXT_PUBLIC_SITE_URL}/m/${tokenResult.token}`;
    const address = addressOf(property);
    message = `Plot360: New visit job. Property: ${property.property_name}. Location: ${address}. Pin: ${property.plot_gps_coordinate || `${property.google_map_lat}, ${property.google_map_lng}`}. Upload link: ${uploadLink} (closes on submit or in 7 days).`;
    await logWhatsAppMessage({ relatedEntityType: 'monitoring_job', relatedEntityId: jobId, recipientPhone: phone, body: message });
  }

  await logAdminAction({
    entityType: 'monitoring_job',
    entityId: jobId,
    action: kind === 'stuck' ? 'Reassigned (previous agent stuck)' : kind === 'visit_request' ? 'Assigned from customer visit request' : 'Assigned (SRO/due-date match)',
  });

  return message ? { success: true as const, jobId, propertyId, phoneCountryCode, phoneNumber, message } : { success: true as const, jobId, propertyId };
}
