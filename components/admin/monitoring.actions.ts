'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';
import { getOrCreateUploadToken } from '@/components/agent/magic-link.actions';
import { maxVisitsForPlan } from '@/lib/subscription';
import { sendNotificationEmail } from '@/lib/email';
import { creditToConsume } from '@/lib/visitCredits';

// Eligible = verified + the MOST RECENT payment for the property is
// actually 'completed' + no currently-open monitoring job (assigned/
// accepted/submitted) + fewer visits done than the plan allows.
//
// The FIRST visit of a cycle is available immediately on payment
// confirmation — no due-date window applies to it. Only the SECOND visit
// (only relevant for 12-month plans, which allow 2) waits for the
// 15-day-before-due window, matching the twice-yearly cadence.
//
// How many visits a plan allows: 6-month plan → 1 visit, 12-month plan →
// 2 visits (every ~6 months). Falls back to 1 visit for a payment with no
// plan attached (e.g. one recorded manually by an admin without going
// through the subscribe flow).
const DUE_WINDOW_DAYS = 15;

export async function getEligiblePropertiesForAssignment() {
  const supabase = await createClient();
  const { data: openJobs } = await supabase
    .from('monitoring_jobs')
    .select('property_id')
    .in('status', ['assigned', 'accepted', 'submitted', 'ec_pending', 'rejected']);
  const openPropertyIds = (openJobs ?? []).map((j) => j.property_id);

  let query: any = supabase
    .from('properties')
    .select('id, property_name, street_address, village_town, district, state, sro_name, sro_code, next_monitoring_due_date, owner_id, profiles(first_name, last_name, email)')
    .eq('status', 'verified')
    .not('expiration_date', 'is', null);

  if (openPropertyIds.length > 0) {
    query = query.not('id', 'in', `(${openPropertyIds.join(',')})`);
  }

  const { data } = await query.order('next_monitoring_due_date', { ascending: true, nullsFirst: true });
  type CandidateProperty = {
    id: string;
    property_name: string;
    street_address: string | null;
    village_town: string | null;
    district: string | null;
    state: string | null;
    sro_name: string | null;
    sro_code: string | null;
    next_monitoring_due_date: string | null;
    owner_id: string;
    profiles: any;
  };
  const candidates: CandidateProperty[] = data ?? [];
  if (candidates.length === 0) return [];

  const { data: payments } = await supabase
    .from('payments')
    .select('property_id, status, valid_from, created_at, subscription_plans(validity_months)')
    .in('property_id', candidates.map((p) => p.id))
    .order('created_at', { ascending: false });

  const latestPaymentByProperty: Record<string, { status: string; valid_from: string | null; validityMonths: number | null }> = {};
  for (const payment of payments ?? []) {
    if (!latestPaymentByProperty[payment.property_id]) {
      const plan: any = payment.subscription_plans;
      latestPaymentByProperty[payment.property_id] = {
        status: payment.status,
        valid_from: payment.valid_from,
        validityMonths: plan?.validity_months ?? null,
      };
    }
  }

  const paidCandidates = candidates.filter((p) => latestPaymentByProperty[p.id]?.status === 'completed');
  if (paidCandidates.length === 0) return [];

  // Count approved visits since the CURRENT cycle started (the latest
  // completed payment's valid_from) — a prior cycle's visits don't count
  // against this one, so the count naturally resets on each renewal.
  const { data: approvedJobs } = await supabase
    .from('monitoring_jobs')
    .select('property_id, decided_at')
    .in('property_id', paidCandidates.map((p) => p.id))
    .eq('status', 'approved');

  const visitCountByProperty: Record<string, number> = {};
  for (const job of approvedJobs ?? []) {
    const cycleStart = latestPaymentByProperty[job.property_id]?.valid_from;
    if (!job.decided_at || !cycleStart) continue;
    if (new Date(job.decided_at) >= new Date(cycleStart)) {
      visitCountByProperty[job.property_id] = (visitCountByProperty[job.property_id] ?? 0) + 1;
    }
  }

  const today = new Date();

  // Redesign 2026-09 (follow-up) — Plot: the Job assignment queue's
  // "Oldest waiting" sort had nothing to sort by for a first-visit
  // property — getLegacyAssignmentTargets only ever exposed
  // next_monitoring_due_date as "how long has this been waiting", and
  // that column is only ever set for the SECOND+ visit window (see
  // recordPayment/purchaseVisitCredits — deliberately left null for a
  // plan-based first payment, which is now nearly every payment). So
  // every first-visit row reported waitHours=0 no matter how long it had
  // actually been sitting unassigned, and both sort buttons produced the
  // same (tied, insertion-order) result. eligibleSince gives a first-visit
  // row a real timestamp to sort by: the payment that made it eligible
  // (its valid_from, i.e. when the plan/credits activated).
  return paidCandidates
    .filter((p) => {
      const visitsDone = visitCountByProperty[p.id] ?? 0;
      const maxVisits = maxVisitsForPlan(latestPaymentByProperty[p.id]?.validityMonths);
      if (visitsDone >= maxVisits) return false;

      // First visit: always immediately eligible, no due-date window.
      if (visitsDone === 0) return true;

      // Second (and only) subsequent visit: apply the 15-day-before-due window.
      if (!p.next_monitoring_due_date) return false;
      const daysUntilDue = Math.ceil((new Date(p.next_monitoring_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= DUE_WINDOW_DAYS;
    })
    .map((p) => {
      const visitsDone = visitCountByProperty[p.id] ?? 0;
      return {
        ...p,
        eligible_since: visitsDone === 0 ? latestPaymentByProperty[p.id]?.valid_from ?? null : null,
      };
    });
}

export async function getVerifiedAgentsList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, profiles(first_name, last_name, email)')
    .eq('status', 'verified');
  return data ?? [];
}

export async function assignAgentToProperty(propertyId: string, agentId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: latestPayment } = await supabase
    .from('payments')
    .select('status, valid_from, subscription_plans(validity_months)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestPayment?.status !== 'completed') {
    return { error: "This property's payment isn't completed yet — it can't be assigned for monitoring." };
  }

  const { data: existingOpenJob } = await supabase
    .from('monitoring_jobs')
    .select('id')
    .eq('property_id', propertyId)
    .in('status', ['assigned', 'accepted', 'submitted', 'ec_pending', 'rejected'])
    .maybeSingle();
  if (existingOpenJob) {
    return { error: 'This property already has an open monitoring job — use Reassign on it instead of creating a new one.' };
  }

  if (latestPayment.valid_from) {
    const { count } = await supabase
      .from('monitoring_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'approved')
      .gte('decided_at', latestPayment.valid_from);
    const plan: any = latestPayment.subscription_plans;
    const maxVisits = maxVisitsForPlan(plan?.validity_months);
    if ((count ?? 0) >= maxVisits) {
      return { error: `This property already has ${maxVisits} completed verification${maxVisits > 1 ? 's' : ''} for the current cycle.` };
    }
  }

  // Redesign 2026-09 (follow-up, round 20) — this "legacy" assignment
  // path is also what round 19 wired up to auto-surface a visit-credits
  // property's FIRST visit. Those properties do have real visit_credits
  // rows even though this function otherwise predates that table
  // entirely, so pick one the same way requestVisit does (oldest expiry
  // first) and attach it to the job — that's what lets
  // finalizeApprovedJob (below) actually mark the credit as used once
  // the visit is done, and what lets the "remaining credits" display
  // count this job as reserved while it's in progress (see
  // getReservedCreditCounts). A true pre-visit-credits legacy property
  // has no visit_credits rows at all, so this is a no-op for it —
  // visit_credit_id stays null, exactly as before.
  const { data: credits } = await supabase.from('visit_credits').select('*').eq('property_id', propertyId).order('expires_at', { ascending: true });
  const credit = creditToConsume(credits ?? []);

  // Redesign 2026-09 (follow-up) — Plot: the customer Home screen showed
  // "Visit 1 · Unused" for a property whose first visit was actually done
  // and had a report — right next to "3 of 4 visit credits left", which
  // was correct (a credit really had been consumed). Root cause: this,
  // the "legacy" assignment path, never set visit_number on the job it
  // created — only the visit_request path (assignAgentToTarget, below)
  // did. CustomerHome.tsx's visitChips() matches a job to a chip strictly
  // by visit_number, so a job with none could never be found and always
  // fell back to "Unused" no matter its real status. Numbering it the
  // same way the visit_request path already does (this property's own
  // running count of monitoring_jobs, oldest first) fixes the display —
  // and doesn't touch anything else, since nothing before this ever
  // relied on this being null.
  const { count: priorVisits } = await supabase
    .from('monitoring_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId);

  const { data, error } = await supabase
    .from('monitoring_jobs')
    .insert({
      property_id: propertyId,
      agent_id: agentId,
      assigned_by: userData.user?.id,
      status: 'assigned',
      visit_credit_id: credit?.id ?? null,
      visit_number: (priorVisits ?? 0) + 1,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  // Deliberately NOT calling revalidatePath here — that would immediately
  // refresh the page and remove this property from the "needs assignment"
  // list before the admin has had a chance to click "Send via WhatsApp".
  // The list refreshes once the admin clicks "Done" in the confirmation
  // panel instead (see AssignAgentForm).
  return { success: true, jobId: data.id };
}

// Reassigns a job that's stuck with its current agent (dropped, no-show,
// couldn't finish in time) to a different agent. Only allowed while the
// job is still in progress — not once it's been submitted for review or
// already approved, since that work shouldn't be discarded. Wipes any
// partial uploads and revokes the old agent's upload link, since the new
// agent will carry out their own fresh visit.
export async function reassignMonitoringJob(jobId: string, newAgentId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: job } = await supabase.from('monitoring_jobs').select('status, agent_id').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (!['assigned', 'accepted', 'rejected'].includes(job.status)) {
    return { error: 'This job can only be reassigned while still in progress (not yet submitted or approved).' };
  }
  if (job.agent_id === newAgentId) return { error: 'Already assigned to that agent.' };

  const { data: oldMedia } = await supabase.from('monitoring_media').select('file_path').eq('job_id', jobId);
  if (oldMedia && oldMedia.length > 0) {
    await supabase.storage.from('monitoring-media').remove(oldMedia.map((m) => m.file_path));
    await supabase.from('monitoring_media').delete().eq('job_id', jobId);
  }
  await supabase.from('monitoring_upload_tokens').delete().eq('job_id', jobId);

  const { error } = await supabase
    .from('monitoring_jobs')
    .update({
      agent_id: newAgentId,
      status: 'assigned',
      observations: null,
      submitted_at: null,
      decided_at: null,
      admin_feedback: null,
    })
    .eq('id', jobId);
  if (error) return { error: error.message };

  return { success: true };
}

// For the admin property page — full job history including who's
// assigned and current status, so a stray/duplicate job (e.g. created
// before the duplicate-job guard existed) can be spotted and removed.
export async function getMonitoringJobHistoryForAdmin(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select('id, status, assigned_at, decided_at, agent_profiles(profiles(first_name, last_name))')
    .eq('property_id', propertyId)
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

// Deletes a stray/duplicate job entirely — cleans up its storage files
// first (DB cascade removes the monitoring_media/monitoring_upload_tokens
// rows automatically, but not the actual files sitting in storage).
// Blocked on 'submitted' so a job actively awaiting review can't be
// deleted out from under an admin mid-decision — everything else
// (assigned/accepted/rejected/ec_pending/approved) can be removed as a
// manual cleanup tool.
export async function deleteMonitoringJob(jobId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: job } = await supabase.from('monitoring_jobs').select('status, property_id, visit_credit_id').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (job.status === 'submitted') {
    return { error: 'This job is currently awaiting review — decide it first, then delete if still needed.' };
  }

  const { data: media } = await supabase.from('monitoring_media').select('file_path').eq('job_id', jobId);
  if (media && media.length > 0) {
    await supabase.storage.from('monitoring-media').remove(media.map((m) => m.file_path));
  }

  const { error } = await supabase.from('monitoring_jobs').delete().eq('id', jobId);
  if (error) return { error: error.message };

  // Redesign 2026-09 (follow-up, round 20) — a stray/duplicate job that
  // already reached 'approved' already incremented its visit_credit's
  // quantity_used (see finalizeApprovedJob); deleting it as cleanup
  // should give that credit back rather than leaving it permanently
  // marked used for a job that no longer exists. An 'ec_pending' job
  // never incremented quantity_used yet (that only happens once it
  // actually closes out to 'approved'), so it needs no release.
  if (job.status === 'approved' && job.visit_credit_id) {
    const { data: credit } = await supabase.from('visit_credits').select('quantity_used').eq('id', job.visit_credit_id).maybeSingle();
    if (credit && credit.quantity_used > 0) {
      await supabase.from('visit_credits').update({ quantity_used: credit.quantity_used - 1 }).eq('id', job.visit_credit_id);
    }
  }

  revalidatePath(`/admin/${job.property_id}`);
  revalidatePath('/admin/monitoring');
  revalidatePath(`/properties/${job.property_id}`);
  return { success: true };
}
// re-upload" WhatsApp message — agent's phone plus a valid upload link
// (reuses the existing one if still valid, otherwise generates a fresh
// 7-day one, exactly like the initial assignment message).
export async function getRejectionWhatsAppDetails(jobId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: job } = await supabase
    .from('monitoring_jobs')
    .select('property_id, admin_feedback, agent_profiles(profiles(phone_country_code, phone_number))')
    .eq('id', jobId)
    .single();
  if (!job) return { error: 'Job not found.' };

  const { data: property } = await supabase
    .from('properties')
    .select('property_name')
    .eq('id', job.property_id)
    .single();
  if (!property) return { error: 'Property not found.' };

  const tokenResult = await getOrCreateUploadToken(jobId);
  if ('error' in tokenResult) return { error: tokenResult.error };

  const agentProfile: any = job.agent_profiles;
  return {
    success: true,
    phoneCountryCode: agentProfile?.profiles?.phone_country_code,
    phoneNumber: agentProfile?.profiles?.phone_number,
    propertyName: property.property_name,
    feedback: job.admin_feedback || 'Please review and resubmit.',
    uploadLink: `${process.env.NEXT_PUBLIC_SITE_URL}/m/${tokenResult.token}`,
  };
}
// property details, the agent's phone number, and a fresh magic upload link.
export async function getAssignmentWhatsAppDetails(jobId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: job } = await supabase
    .from('monitoring_jobs')
    .select('property_id, agent_profiles(profiles(first_name, last_name, username, phone_country_code, phone_number))')
    .eq('id', jobId)
    .single();
  if (!job) return { error: 'Job not found.' };

  const { data: property } = await supabase
    .from('properties')
    .select('property_name, plot_size, plot_size_unit, street_address, village_town, district, state, google_map_lat, google_map_lng, plot_gps_coordinate, near_by_landmark')
    .eq('id', job.property_id)
    .single();
  if (!property) return { error: 'Property not found.' };

  const tokenResult = await getOrCreateUploadToken(jobId);
  if ('error' in tokenResult) return { error: tokenResult.error };

  const agentProfile: any = job.agent_profiles;
  // Redesign 2026-09 (follow-up, 2026-09-26) — agentName added so the
  // assignment/reassignment WhatsApp messages (whatsapp.ts) can open with
  // "Dear <agent name>," per Plot's professional-message ask, instead of
  // never addressing the agent by name at all.
  const agentProfileRow = agentProfile?.profiles;
  const agentName = agentProfileRow
    ? [agentProfileRow.first_name, agentProfileRow.last_name].filter(Boolean).join(' ') || agentProfileRow.username || 'Agent'
    : 'Agent';
  return {
    success: true,
    phoneCountryCode: agentProfile?.profiles?.phone_country_code,
    phoneNumber: agentProfile?.profiles?.phone_number,
    agentName,
    property,
    uploadLink: `${process.env.NEXT_PUBLIC_SITE_URL}/m/${tokenResult.token}`,
  };
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: a property with an
// agent already assigned (or in progress, or submitted) wasn't showing up
// ANYWHERE in the admin console he could find — the two queues
// (Job assignment / Agent submissions) only ever show a job at the exact
// moment it enters that specific status, and this overview page (the one
// screen that lists every job regardless of status) had no link in the
// sidebar nav at all (see AdminShell.tsx's NAV). Fixed the nav gap
// separately; this select was also missing the property's own
// verification status and owner, which the new search box on this page
// (MonitoringOverview.tsx) needs to match a customer's name, and which
// admins asked to see at a glance without opening the property record.
export async function getAllMonitoringJobs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select(
      `*, properties(id, property_name, next_monitoring_due_date, status, profiles(first_name, last_name, email, phone_country_code, phone_number)), agent_profiles(id, profiles(first_name, last_name, email, phone_country_code, phone_number))`
    )
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: added
// phone_country_code (phone_number was already here) so
// SubmissionReviewScreen.tsx can show the agent's full number beside
// their name — admin reviewing a submission had no way to call them
// directly from this screen.
export async function getJobForReview(jobId: string) {
  const supabase = await createClient();
  const [{ data: job }, { data: media }] = await Promise.all([
    supabase
      .from('monitoring_jobs')
      .select(`*, properties(*), agent_profiles(id, profiles(first_name, last_name, email, phone_country_code, phone_number))`)
      .eq('id', jobId)
      .single(),
    supabase.from('monitoring_media').select('*').eq('job_id', jobId).order('uploaded_at', { ascending: true }),
  ]);

  let ecRequested = false;
  let ecUploaded = false;
  if (job?.property_id) {
    const [{ data: ownership }, { data: ecDoc }] = await Promise.all([
      supabase.from('property_ownership').select('ec_digital_copy_requested').eq('property_id', job.property_id).maybeSingle(),
      supabase.from('property_documents').select('id').eq('property_id', job.property_id).eq('doc_type', 'ec_digital_copy').maybeSingle(),
    ]);
    ecRequested = !!ownership?.ec_digital_copy_requested;
    ecUploaded = !!ecDoc;
  }

  return { job, media: media ?? [], ecRequested, ecUploaded };
}

export async function getMonitoringMediaUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('monitoring-media').createSignedUrl(filePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: "Manager or admin can
// also be allowed to edit submitted agent job Overall plot condition,
// Anything needing the owner's attention?, and Agent's notes while
// reviewing it (to correct any spelling mistakes or add or remove other
// values)." These three are free-text, agent-typed-on-a-phone fields
// (q_overall_condition, q_attention_needed, observations) — unlike the
// other eight fixed Yes/No checks, there's real value in an admin fixing a
// typo or tightening the wording before it reaches the customer's report
// and PDF (visitReportPdf.ts reads these same columns live, so a
// correction here is picked up automatically, no separate PDF-side change
// needed). Optional and additive: omitting `overrides` (or a given key
// within it) leaves that column untouched, so every existing caller of
// decideMonitoringJob keeps working unchanged.
export type SubmissionAnswerOverrides = {
  q_overall_condition?: string;
  q_attention_needed?: string;
  observations?: string;
};

// Approve: locks the job, and schedules the NEXT monitoring 6 months out.
// Reject: sends it back to the agent with feedback explaining why.
export async function decideMonitoringJob(
  jobId: string,
  propertyId: string,
  decision: 'approved' | 'rejected',
  feedback?: string,
  adminRemarks?: string,
  overrides?: SubmissionAnswerOverrides
) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  // If the customer asked for a Digital EC copy and admin hasn't uploaded
  // it yet, the job can't be marked fully complete — the agent's photos/
  // videos still get released to the customer (see MonitoringStatus,
  // which treats 'ec_pending' the same as 'approved' for media display),
  // but the job itself stays open until finalizeEcPendingJob runs (see
  // uploadEcDigitalCopy) once the EC document is actually uploaded.
  let effectiveDecision: 'approved' | 'rejected' | 'ec_pending' = decision;
  if (decision === 'approved') {
    const { data: ownership } = await supabase
      .from('property_ownership')
      .select('ec_digital_copy_requested')
      .eq('property_id', propertyId)
      .maybeSingle();
    if (ownership?.ec_digital_copy_requested) {
      const { data: ecDoc } = await supabase
        .from('property_documents')
        .select('id')
        .eq('property_id', propertyId)
        .eq('doc_type', 'ec_digital_copy')
        .maybeSingle();
      if (!ecDoc) effectiveDecision = 'ec_pending';
    }
  }

  const { error: jobError } = await supabase
    .from('monitoring_jobs')
    .update({
      status: effectiveDecision,
      admin_feedback: decision === 'rejected' ? feedback || null : null,
      admin_remarks: decision === 'approved' ? adminRemarks?.trim() || null : null,
      decided_at: new Date().toISOString(),
      ...(overrides?.q_overall_condition !== undefined ? { q_overall_condition: overrides.q_overall_condition.trim() } : {}),
      ...(overrides?.q_attention_needed !== undefined ? { q_attention_needed: overrides.q_attention_needed.trim() } : {}),
      ...(overrides?.observations !== undefined ? { observations: overrides.observations.trim() } : {}),
    })
    .eq('id', jobId);
  if (jobError) return { error: jobError.message };

  if (effectiveDecision === 'approved') {
    const result = await finalizeApprovedJob(jobId, propertyId);
    if (result?.error) return { error: result.error };
  } else if (effectiveDecision === 'ec_pending') {
    // Agent's submission has been reviewed and accepted — only the
    // (admin-side) EC paperwork is outstanding, so the agent's upload
    // link closes now too, same as full approval.
    await supabase.from('monitoring_upload_tokens').delete().eq('job_id', jobId);
  }

  // Deliberately NOT calling revalidatePath here — that would immediately
  // refresh the page and yank away the WhatsApp confirmation panel before
  // the admin can click it. The monitoring list refreshes naturally once
  // they navigate there via the "Back to monitoring" button instead.
  return { success: true, ecPending: effectiveDecision === 'ec_pending' };
}

// Runs the "job is truly, fully done" side effects: advances the next
// monitoring due date, revokes the agent's upload link, and emails the
// customer. Shared by the normal approval path above and by
// uploadEcDigitalCopy, which calls this once the outstanding EC document
// finally comes in for a job that was held in 'ec_pending'.
async function finalizeApprovedJob(jobId: string, propertyId: string) {
  const supabase = await createClient();
  const nextDue = new Date();
  nextDue.setMonth(nextDue.getMonth() + 6);
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .update({ next_monitoring_due_date: nextDue.toISOString().slice(0, 10) })
    .eq('id', propertyId)
    .select('property_name, owner_id')
    .single();
  if (propertyError) return { error: propertyError.message };

  // Redesign 2026-09 (follow-up, round 20) — this is "the job is truly,
  // fully done" (this function's own header comment), which is exactly
  // the moment a visit_credits row should actually be marked used. This
  // was the missing half of the ledger: visit_credit_id got attached to
  // a job at assignment time (requestVisit's flow, and now round 19's
  // auto-assigned first visit + the change above), but nothing ever
  // incremented quantity_used, so "remaining credits" never actually
  // went down no matter how many visits were completed. Guarded with a
  // floor at quantity_purchased purely as a safety net — nothing should
  // call finalizeApprovedJob twice for the same job, but an accidental
  // double-call shouldn't be able to push quantity_used past what was
  // actually purchased.
  const { data: job } = await supabase.from('monitoring_jobs').select('visit_credit_id').eq('id', jobId).maybeSingle();
  if (job?.visit_credit_id) {
    const { data: credit } = await supabase
      .from('visit_credits')
      .select('quantity_used, quantity_purchased')
      .eq('id', job.visit_credit_id)
      .maybeSingle();
    if (credit && credit.quantity_used < credit.quantity_purchased) {
      await supabase
        .from('visit_credits')
        .update({ quantity_used: credit.quantity_used + 1 })
        .eq('id', job.visit_credit_id);
    }
  }

  // Revoke the agent's upload link the moment work is confirmed complete —
  // per the requirement that access ends as soon as the job is approved,
  // not just after the token's 7-day window.
  await supabase.from('monitoring_upload_tokens').delete().eq('job_id', jobId);

  if (property) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', property.owner_id)
      .single();
    if (ownerProfile?.email) {
      await sendNotificationEmail({
        to: ownerProfile.email,
        subject: `Visit verified: ${property.property_name}`,
        heading: 'Your property visit is verified',
        accent: '#1a7f37',
        bodyLines: [
          `Hi ${ownerProfile.first_name || 'there'},`,
          `The recent physical verification for "${property.property_name}" has been reviewed and approved. Photos and videos are now available to download from your property page.`,
        ],
        ctaText: 'View property',
        ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://uat.plot360.in'}/properties/${propertyId}`,
      });
    }
  }
  return { success: true };
}

// Admin uploads the actual Digital EC document for a property (received
// externally, e.g. from the sub-registrar's office) — this is different
// from ec_reference_copy, which is the customer's own reference upload
// during registration. If a job for this property is sitting in
// 'ec_pending', uploading the EC finally closes it out.
// Redesign 2026-09 (follow-up) — signed-upload-url step for the EC
// digital copy (often a scanned PDF from the sub-registrar's office);
// see lib/uploadDirect.ts and ARCHITECTURE.md #60.
export async function createEcDigitalCopyUploadUrl(propertyId: string, fileName: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const path = `${propertyId}/ec_digital_copy-${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage.from('property-documents').createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { success: true, bucket: 'property-documents' as const, path, token: data.token };
}

export async function uploadEcDigitalCopy(propertyId: string, path: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('property_documents')
    .select('id, file_path')
    .eq('property_id', propertyId)
    .eq('doc_type', 'ec_digital_copy')
    .maybeSingle();

  const docError = existing
    ? (await supabase.from('property_documents').update({ file_path: path }).eq('id', existing.id)).error
    : (await supabase.from('property_documents').insert({ property_id: propertyId, doc_type: 'ec_digital_copy', file_path: path })).error;
  if (docError) return { error: docError.message };

  if (existing?.file_path && existing.file_path !== path) {
    await supabase.storage.from('property-documents').remove([existing.file_path]);
  }

  // Close out any job that was waiting specifically on this document.
  const { data: waitingJob } = await supabase
    .from('monitoring_jobs')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'ec_pending')
    .maybeSingle();
  if (waitingJob) {
    await supabase.from('monitoring_jobs').update({ status: 'approved' }).eq('id', waitingJob.id);
    const result = await finalizeApprovedJob(waitingJob.id, propertyId);
    if (result?.error) return { error: result.error };
  }

  revalidatePath('/admin/monitoring');
  revalidatePath(`/admin/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}
