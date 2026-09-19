'use server';

import { createClient } from '@/lib/supabase/server';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait, isLate, matchesQuery, paginate, PAGE_SIZE } from '@/lib/adminQueue';
import { getLegacyAssignmentTargets, getVisitRequestAssignmentTargets, getStuckAssignmentTargets } from './assignment.actions';

// Redesign 2026-09 — admin console. One row shape shared by every
// queue table (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"
// — the six sc-if="{{ s.queue }}" tables all share one column layout:
// name/place/state/colD/waiting). Each getXQueue() below builds real
// rows from the existing schema — none of this existed before this
// phase; queues were either a flat unfiltered list (AdminQueue,
// AgentVerificationQueue) or didn't exist as a queue at all (Job
// assignment, Payments mismatches, flagged submissions).
export type QueueRow = {
  id: string;
  name: string;
  place: string;
  state: string;
  urgent: boolean;
  window: string;
  waitHours: number;
  wait: string;
  late: boolean;
  href: string;
};

export type QueueSort = 'urgent' | 'oldest' | 'window' | 'amount';

function finish(rows: (Omit<QueueRow, 'wait' | 'late'> & {})[], query: string, sort: QueueSort, page: number) {
  const filtered = rows.filter((r) => matchesQuery([r.name, r.place, r.state], query));
  const byWait = (a: typeof rows[number], b: typeof rows[number]) => b.waitHours - a.waitHours;
  if (sort === 'window') filtered.sort((a, b) => a.window.localeCompare(b.window) || byWait(a, b));
  else if (sort === 'amount') filtered.sort((a, b) => (Number(b.window.replace(/[^\d]/g, '')) || 0) - (Number(a.window.replace(/[^\d]/g, '')) || 0) || byWait(a, b));
  else if (sort === 'oldest') filtered.sort(byWait);
  else filtered.sort((a, b) => Number(b.urgent) - Number(a.urgent) || byWait(a, b));

  const withWait: QueueRow[] = filtered.map((r) => ({ ...r, wait: formatWait(r.waitHours), late: isLate(r.waitHours) }));
  return paginate(withWait, page, PAGE_SIZE);
}

// ---------- 1. Property verification ----------

export async function getPropertyVerificationQueue(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const supabase = await createClient();
  // Redesign 2026-09 (follow-up, round 18) — Plot asked to also surface
  // rejected properties here so the admin can follow up with customers,
  // and to fold "customer resubmitted after a rejection" into what counts
  // as urgent. A rejected property's status flips back to 'pending' the
  // moment the customer re-saves ownership (saveOwnership,
  // registration.actions.ts) but rejection_reason is deliberately left in
  // place until the admin approves — so status==='pending' with a
  // rejection_reason still set is exactly "customer resubmitted, waiting
  // on admin review", with no schema change needed. A plain
  // status==='rejected' row means the customer hasn't acted yet, so it's
  // shown for follow-up but not flagged urgent (nothing for the admin to
  // do until the customer responds).
  const { data: properties } = await supabase
    .from('properties')
    .select('id, property_name, village_town, district, sro_name, sro_code, created_at, status, rejection_reason')
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: true });
  const list = properties ?? [];
  if (list.length === 0) return { rows: [], total: 0, page: 1, pageCount: 1 };

  const ids = list.map((p) => p.id);
  const [{ data: ownerships }, { data: documents }, { data: payments }] = await Promise.all([
    supabase.from('property_ownership').select('property_id, is_registered_user_owner, noc_file_url, owner_id_proof_url').in('property_id', ids),
    supabase.from('property_documents').select('property_id, doc_type').in('property_id', ids),
    supabase.from('payments').select('property_id, status, subscription_plans(visit_quantity)').in('property_id', ids).order('created_at', { ascending: false }),
  ]);

  const ownershipByProperty: Record<string, any> = {};
  for (const o of ownerships ?? []) ownershipByProperty[o.property_id] = o;
  const docTypesByProperty: Record<string, Set<string>> = {};
  for (const d of documents ?? []) (docTypesByProperty[d.property_id] ??= new Set()).add(d.doc_type);
  const planByProperty: Record<string, any> = {};
  for (const p of payments ?? []) if (!planByProperty[p.property_id]) planByProperty[p.property_id] = p;

  const rows = list.map((p) => {
    const ownership = ownershipByProperty[p.id];
    const docs = docTypesByProperty[p.id] ?? new Set();
    const hasSaleDeed = docs.has('title_deed');
    const hasIdProof = docs.has('owner_id') || !!ownership?.owner_id_proof_url;
    // Redesign 2026-09 (follow-up, round 13) — the Edit ownership page no
    // longer collects an "approval letter" (see OwnershipForm.tsx); the
    // NOC is now the document required only when the plot owner differs
    // from the registering user, so this queue flag tracks that instead.
    const needsNoc = ownership && ownership.is_registered_user_owner === false && !ownership.noc_file_url && !docs.has('noc');
    const wasResubmitted = p.status === 'pending' && !!p.rejection_reason;

    let state: string;
    let urgent: boolean;

    if (p.status === 'rejected') {
      // Rejected and the customer hasn't resubmitted yet — waiting on
      // them, not on the admin, so it's visible for follow-up but not
      // pushed to the top of "Most urgent first".
      state = 'Rejected · follow up with customer';
      urgent = false;
    } else {
      let baseState = 'Ready to verify';
      if (!hasSaleDeed) baseState = 'Docs pending';
      else if (!hasIdProof) baseState = 'ID proof pending';
      else if (needsNoc) baseState = 'NOC pending';

      state = wasResubmitted ? `${baseState} · resubmitted` : baseState;
      urgent = wasResubmitted || needsNoc || baseState === 'Ready to verify';
    }

    const plan = planByProperty[p.id];
    const visitQuantity = plan?.subscription_plans?.visit_quantity;
    const waitHours = hoursSince(p.created_at);

    return {
      id: p.id,
      name: p.property_name,
      place: [p.village_town, p.district, p.sro_code ? `SRO ${p.sro_code}` : null].filter(Boolean).join(' · '),
      state,
      urgent,
      window: visitQuantity ? `${visitQuantity} visit${visitQuantity > 1 ? 's' : ''}` : '—',
      waitHours,
      href: `/admin/${p.id}`,
    };
  });

  return finish(rows, opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}

// ---------- 2. Job assignment ----------

export async function getJobAssignmentQueue(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const [legacy, visitRequests, stuck] = await Promise.all([getLegacyAssignmentTargets(), getVisitRequestAssignmentTargets(), getStuckAssignmentTargets()]);

  const legacyRows = legacy.map((t: any) => {
    const dueHours = t.dueDate ? hoursSince(t.dueDate) : 0;
    // Redesign 2026-09 (follow-up) — Plot: "Oldest waiting" and "Paid but
    // unassigned" looked like they did nothing for this queue, because
    // every first-visit row (no due date — see
    // getEligiblePropertiesForAssignment) fell back to waitHours=0 no
    // matter how long it had actually been sitting unassigned, so both
    // sorts tied and produced the same order. eligibleSince (the payment
    // that made the property eligible) gives those rows a real wait time.
    const waitHours = t.dueDate ? dueHours : hoursSince(t.eligibleSince);
    return {
      id: t.id,
      name: t.propertyName,
      place: [t.sroCode ? `SRO ${t.sroCode}` : null].filter(Boolean).join(' · ') || '—',
      state: 'Verified · unassigned',
      urgent: !!t.dueDate && dueHours > 0,
      window: t.dueDate ? `due ${String(t.dueDate).slice(5)}` : 'not set',
      waitHours,
      href: `/admin/assign/legacy/${t.id}`,
    };
  });

  const visitRequestRows = visitRequests.map((t: any) => ({
    id: t.id,
    name: t.propertyName,
    place: [t.sroCode ? `SRO ${t.sroCode}` : null].filter(Boolean).join(' · ') || '—',
    state: 'Paid · unassigned',
    urgent: true,
    window: t.window ?? 'not set',
    waitHours: hoursSince(t.createdAt),
    href: `/admin/assign/visit_request/${t.id}`,
  }));

  const stuckRows = stuck.map((t: any) => ({
    id: t.id,
    name: t.propertyName,
    place: [t.sroCode ? `SRO ${t.sroCode}` : null].filter(Boolean).join(' · ') || '—',
    state: 'Reassignment needed',
    urgent: true,
    window: t.window,
    waitHours: hoursSince(t.assignedAt),
    href: `/admin/assign/stuck/${t.jobId}`,
  }));

  return finish([...legacyRows, ...visitRequestRows, ...stuckRows], opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}

// ---------- 3. Agent submissions ----------

export async function getAgentSubmissionsQueue(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select('id, submitted_at, flagged, admin_feedback, properties(property_name, sro_code), agent_profiles(profiles(first_name, last_name))')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true });

  const rows = (data ?? []).map((j: any) => {
    const state = j.flagged ? 'Submitted · location flagged' : j.admin_feedback ? 'Resubmitted after rework' : 'Submitted';
    return {
      id: j.id,
      name: j.properties?.property_name ?? 'Property',
      place: profileDisplayName(j.agent_profiles?.profiles),
      state,
      urgent: !!j.flagged,
      window: j.submitted_at ? j.submitted_at.slice(0, 10) : '—',
      waitHours: hoursSince(j.submitted_at),
      href: `/admin/monitoring/${j.id}`,
    };
  });

  return finish(rows, opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}

// ---------- 4. Agent verification ----------

export async function getAgentVerificationQueueRows(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, sro_name, sro_code, created_at, profiles(first_name, last_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  const list = data ?? [];
  if (list.length === 0) return { rows: [], total: 0, page: 1, pageCount: 1 };

  const ids = list.map((a) => a.id);
  const { data: docs } = await supabase.from('agent_documents').select('agent_id, doc_type').in('agent_id', ids);
  const docCountByAgent: Record<string, number> = {};
  for (const d of docs ?? []) docCountByAgent[d.agent_id] = (docCountByAgent[d.agent_id] ?? 0) + 1;

  const rows = list.map((a: any) => {
    const docCount = docCountByAgent[a.id] ?? 0;
    const missing = docCount < 2;
    return {
      id: a.id,
      name: profileDisplayName(a.profiles),
      place: [a.sro_name, a.sro_code].filter(Boolean).join(' '),
      state: missing ? 'Documents missing' : 'Awaiting review',
      urgent: missing,
      window: `${docCount} of 2`,
      waitHours: hoursSince(a.created_at),
      href: `/admin/agents/${a.id}`,
    };
  });

  return finish(rows, opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}

// ---------- 5. Service requests ----------

export async function getServiceRequestsQueue(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_requests')
    .select('id, subject, updated_at, profiles(first_name, last_name, email, phone_country_code, phone_number)')
    .eq('status', 'open')
    .order('updated_at', { ascending: true });
  const list = data ?? [];
  if (list.length === 0) return { rows: [], total: 0, page: 1, pageCount: 1 };

  const ids = list.map((r) => r.id);
  const { data: messages } = await supabase
    .from('service_request_messages')
    .select('request_id, sender_role, created_at, service_request_attachments(id)')
    .in('request_id', ids)
    .order('created_at', { ascending: true });

  const lastRoleByRequest: Record<string, string> = {};
  const customerStreakByRequest: Record<string, number> = {};
  const attachmentCountByRequest: Record<string, number> = {};
  for (const m of messages ?? []) {
    lastRoleByRequest[m.request_id] = m.sender_role;
    customerStreakByRequest[m.request_id] = m.sender_role === 'customer' ? (customerStreakByRequest[m.request_id] ?? 0) + 1 : 0;
    attachmentCountByRequest[m.request_id] = (attachmentCountByRequest[m.request_id] ?? 0) + (m.service_request_attachments?.length ?? 0);
  }

  const rows = list.map((r: any) => {
    const lastRole = lastRoleByRequest[r.id];
    const followUps = customerStreakByRequest[r.id] ?? 0;
    const state = followUps >= 2 ? 'Open · second follow-up' : lastRole === 'admin' ? 'Replied · awaiting customer' : 'Open';
    const attachmentCount = attachmentCountByRequest[r.id] ?? 0;
    return {
      id: r.id,
      name: r.subject,
      place: profileDisplayName(r.profiles),
      state,
      urgent: state === 'Open · second follow-up',
      window: attachmentCount > 0 ? `${attachmentCount} file${attachmentCount > 1 ? 's' : ''}` : 'none',
      waitHours: hoursSince(r.updated_at),
      href: `/admin/service-requests/${r.id}`,
    };
  });

  return finish(rows, opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}

// ---------- 6. Payments ----------

export async function getPaymentsQueue(opts: { query?: string; sort?: QueueSort; page?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('id, amount, transaction_reference, mismatch_reason, created_at, properties(property_name, profiles(first_name, last_name, email))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const rows = (data ?? []).map((p: any) => {
    const state = p.mismatch_reason ? 'Amount mismatch' : p.transaction_reference ? 'Reference submitted' : 'Bank transfer · unconfirmed';
    return {
      id: p.id,
      name: p.properties?.property_name ?? 'Property',
      place: profileDisplayName(p.properties?.profiles),
      state,
      urgent: !!p.mismatch_reason,
      window: p.amount ? `₹${Number(p.amount).toLocaleString('en-IN')}` : '—',
      waitHours: hoursSince(p.created_at),
      href: `/admin/payments/${p.id}`,
    };
  });

  return finish(rows, opts.query ?? '', opts.sort ?? 'urgent', opts.page ?? 1);
}
