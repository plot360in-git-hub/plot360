'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';
import { getOrCreateUploadToken } from '@/components/agent/magic-link.actions';

// Eligible = verified + the MOST RECENT payment for the property is
// actually 'completed' + no currently-open monitoring job (assigned/
// accepted/submitted) + fewer than 2 approved verifications since the
// current payment cycle started + next due date is within 15 days (or
// already overdue). Checking the latest payment's status directly
// (rather than just "expiration_date is set") matters because a property
// can have an old expiration_date from a prior paid cycle while its
// newest payment (e.g. a renewal) is still pending — that property is
// NOT currently eligible until that payment is confirmed.
const DUE_WINDOW_DAYS = 15;
const MAX_VISITS_PER_CYCLE = 2;

export async function getEligiblePropertiesForAssignment() {
  const supabase = await createClient();
  const { data: openJobs } = await supabase
    .from('monitoring_jobs')
    .select('property_id')
    .in('status', ['assigned', 'accepted', 'submitted']);
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
  const candidates = data ?? [];
  if (candidates.length === 0) return [];

  // Only within the 15-day window (or already overdue) even gets checked further.
  const today = new Date();
  const dueSoon = candidates.filter((p) => {
    if (!p.next_monitoring_due_date) return false;
    const daysUntilDue = Math.ceil((new Date(p.next_monitoring_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= DUE_WINDOW_DAYS;
  });
  if (dueSoon.length === 0) return [];

  const { data: payments } = await supabase
    .from('payments')
    .select('property_id, status, valid_from, created_at')
    .in('property_id', dueSoon.map((p) => p.id))
    .order('created_at', { ascending: false });

  const latestPaymentByProperty: Record<string, { status: string; valid_from: string | null }> = {};
  for (const payment of payments ?? []) {
    if (!latestPaymentByProperty[payment.property_id]) {
      latestPaymentByProperty[payment.property_id] = { status: payment.status, valid_from: payment.valid_from };
    }
  }

  const paidCandidates = dueSoon.filter((p) => latestPaymentByProperty[p.id]?.status === 'completed');
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

  return paidCandidates.filter((p) => (visitCountByProperty[p.id] ?? 0) < MAX_VISITS_PER_CYCLE);
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
    .select('status, valid_from')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestPayment?.status !== 'completed') {
    return { error: "This property's payment isn't completed yet — it can't be assigned for monitoring." };
  }

  if (latestPayment.valid_from) {
    const { count } = await supabase
      .from('monitoring_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'approved')
      .gte('decided_at', latestPayment.valid_from);
    if ((count ?? 0) >= MAX_VISITS_PER_CYCLE) {
      return { error: 'This property already has 2 completed verifications for the current cycle.' };
    }
  }

  const { data, error } = await supabase
    .from('monitoring_jobs')
    .insert({
      property_id: propertyId,
      agent_id: agentId,
      assigned_by: userData.user?.id,
      status: 'assigned',
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

// Gathers everything needed to build the "job assigned" WhatsApp message:
// property details, the agent's phone number, and a fresh magic upload link.
export async function getAssignmentWhatsAppDetails(jobId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: job } = await supabase
    .from('monitoring_jobs')
    .select('property_id, agent_profiles(profiles(phone_country_code, phone_number))')
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
  return {
    success: true,
    phoneCountryCode: agentProfile?.profiles?.phone_country_code,
    phoneNumber: agentProfile?.profiles?.phone_number,
    property,
    uploadLink: `${process.env.NEXT_PUBLIC_SITE_URL}/m/${tokenResult.token}`,
  };
}

export async function getAllMonitoringJobs() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select(
      `*, properties(id, property_name, next_monitoring_due_date), agent_profiles(id, profiles(first_name, last_name, email))`
    )
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

export async function getJobForReview(jobId: string) {
  const supabase = await createClient();
  const [{ data: job }, { data: media }] = await Promise.all([
    supabase
      .from('monitoring_jobs')
      .select(`*, properties(*), agent_profiles(id, profiles(first_name, last_name, email, phone_number))`)
      .eq('id', jobId)
      .single(),
    supabase.from('monitoring_media').select('*').eq('job_id', jobId).order('uploaded_at', { ascending: true }),
  ]);
  return { job, media: media ?? [] };
}

export async function getMonitoringMediaUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('monitoring-media').createSignedUrl(filePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

// Approve: locks the job, and schedules the NEXT monitoring 6 months out.
// Reject: sends it back to the agent with feedback explaining why.
export async function decideMonitoringJob(
  jobId: string,
  propertyId: string,
  decision: 'approved' | 'rejected',
  feedback?: string
) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { error: jobError } = await supabase
    .from('monitoring_jobs')
    .update({
      status: decision,
      admin_feedback: decision === 'rejected' ? feedback || null : null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (jobError) return { error: jobError.message };

  if (decision === 'approved') {
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 6);
    const { error: propertyError } = await supabase
      .from('properties')
      .update({ next_monitoring_due_date: nextDue.toISOString().slice(0, 10) })
      .eq('id', propertyId);
    if (propertyError) return { error: propertyError.message };

    // Revoke the agent's upload link the moment work is confirmed complete —
    // per the requirement that access ends as soon as the job is approved,
    // not just after the token's 7-day window.
    await supabase.from('monitoring_upload_tokens').delete().eq('job_id', jobId);
  }

  revalidatePath('/admin/monitoring');
  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}
