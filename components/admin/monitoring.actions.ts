'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';
import { getOrCreateUploadToken } from '@/components/agent/magic-link.actions';
import { maxVisitsForPlan } from '@/lib/subscription';
import { sendNotificationEmail } from '@/lib/email';

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

  return paidCandidates.filter((p) => {
    const visitsDone = visitCountByProperty[p.id] ?? 0;
    const maxVisits = maxVisitsForPlan(latestPaymentByProperty[p.id]?.validityMonths);
    if (visitsDone >= maxVisits) return false;

    // First visit: always immediately eligible, no due-date window.
    if (visitsDone === 0) return true;

    // Second (and only) subsequent visit: apply the 15-day-before-due window.
    if (!p.next_monitoring_due_date) return false;
    const daysUntilDue = Math.ceil((new Date(p.next_monitoring_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilDue <= DUE_WINDOW_DAYS;
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

  const { data: job } = await supabase.from('monitoring_jobs').select('status, property_id').eq('id', jobId).single();
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

// Approve: locks the job, and schedules the NEXT monitoring 6 months out.
// Reject: sends it back to the agent with feedback explaining why.
export async function decideMonitoringJob(
  jobId: string,
  propertyId: string,
  decision: 'approved' | 'rejected',
  feedback?: string,
  adminRemarks?: string
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

  revalidatePath('/admin/monitoring');
  revalidatePath(`/properties/${propertyId}`);
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
export async function uploadEcDigitalCopy(propertyId: string, formData: FormData) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const file = formData.get('ec_digital_copy') as File | null;
  if (!file || file.size === 0) return { error: 'Please choose a file to upload.' };

  const { data: existing } = await supabase
    .from('property_documents')
    .select('id, file_path')
    .eq('property_id', propertyId)
    .eq('doc_type', 'ec_digital_copy')
    .maybeSingle();

  const path = `${propertyId}/ec_digital_copy-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('property-documents').upload(path, file);
  if (uploadError) return { error: uploadError.message };

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
