'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { extractVisitAnswers } from '@/lib/visitReportQuestions';
import { GPS_FLAG_THRESHOLD_METERS } from '@/lib/geo';

// Limited-field property view for agents — deliberately excludes size,
// description, ownership, and documents. Only what's needed to locate and
// identify the plot.
export async function getMyJobs() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data } = await supabase
    .from('monitoring_jobs')
    .select(
      `id, status, assigned_at, accepted_at, submitted_at, admin_feedback, visit_number, requested_window_start, requested_window_end,
      properties(id, property_name, street_address, village_town, district, state, plot_gps_coordinate, google_map_lat, google_map_lng, sro_name, sro_code)`
    )
    .eq('agent_id', userData.user.id)
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

export async function getJobDetail(jobId: string) {
  const supabase = await createClient();
  const [{ data: job }, { data: media }] = await Promise.all([
    supabase
      .from('monitoring_jobs')
      .select(
        `*, properties(id, property_name, street_address, village_town, district, state, plot_gps_coordinate, google_map_lat, google_map_lng, near_by_landmark, sro_name, sro_code)`
      )
      .eq('id', jobId)
      .single(),
    supabase.from('monitoring_media').select('*').eq('job_id', jobId).order('uploaded_at', { ascending: true }),
  ]);
  return { job, media: media ?? [] };
}

// A job is workable the moment it's assigned — there's no separate accept
// step. The confirmation happens off-platform: the admin calls the agent
// and only assigns once the agent has verbally agreed to take it on.
const WORKABLE_STATUSES = ['assigned', 'accepted', 'rejected']; // 'accepted' kept for any pre-existing rows

async function requireOwnJob(jobId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };

  const { data: job } = await supabase.from('monitoring_jobs').select('agent_id, status').eq('id', jobId).single();
  if (!job) return { ok: false as const, error: 'Job not found.' };
  if (job.agent_id !== userData.user.id) return { ok: false as const, error: 'Not authorized.' };
  if (job.status === 'approved') return { ok: false as const, error: 'This job is already complete and locked.' };
  if (job.status === 'submitted') return { ok: false as const, error: 'Already submitted — wait for admin review before adding more.' };
  if (!WORKABLE_STATUSES.includes(job.status)) return { ok: false as const, error: 'This job cannot be updated right now.' };
  return { ok: true as const, supabase };
}

// Redesign 2026-09 (follow-up) — split the old single uploadJobMedia
// (which uploaded file bytes straight through this Server Action, hitting
// Vercel's hard 4.5MB function body limit on real phone photos/video —
// see ARCHITECTURE.md #60) into "get me somewhere to upload" + "record
// what I uploaded". The bytes now go browser → Supabase Storage directly
// via a signed upload URL (lib/uploadDirect.ts), never through this
// function at all.
export async function createJobMediaUploadUrls(jobId: string, fileNames: string[]) {
  const gate = await requireOwnJob(jobId);
  if (!gate.ok) return { error: gate.error };
  if (fileNames.length === 0) return { error: 'No files selected.' };

  const uploads: { fileName: string; path: string; token: string }[] = [];
  for (let i = 0; i < fileNames.length; i++) {
    const path = `${jobId}/${Date.now()}-${i}-${fileNames[i]}`;
    const { data, error } = await gate.supabase.storage.from('monitoring-media').createSignedUploadUrl(path);
    if (error) return { error: error.message };
    uploads.push({ fileName: fileNames[i], path, token: data.token });
  }
  return { success: true, bucket: 'monitoring-media' as const, uploads };
}

// Redesign 2026-09 — optional boundary-side tag applied to every photo in
// this batch (design_handoff_plot360_redesign, "Plot360 Agent.dc.html",
// the "Boundary sides covered" checklist — see AgentCaptureScreen.tsx,
// which derives the checklist from which sides have at least one tagged
// photo rather than a separate manual checkbox).
export async function recordJobMedia(jobId: string, items: { path: string; mediaType: string }[], boundarySide?: string | null) {
  const gate = await requireOwnJob(jobId);
  if (!gate.ok) return { error: gate.error };
  if (items.length === 0) return { error: 'No files selected.' };

  const side = (['N', 'E', 'S', 'W'] as const).includes(boundarySide as any) ? boundarySide : null;

  for (const item of items) {
    const { error: insertError } = await gate.supabase
      .from('monitoring_media')
      .insert({ job_id: jobId, media_type: item.mediaType, file_path: item.path, boundary_side: item.mediaType === 'photo' ? side : null });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/agent/jobs/${jobId}`);
  return { success: true };
}

// Final submission: just the observations + flips status to 'submitted'.
// Requires at least one media item already uploaded via uploadJobMedia.
export async function submitJobWork(jobId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: job } = await supabase.from('monitoring_jobs').select('agent_id, status').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (job.agent_id !== userData.user.id) return { error: 'Not authorized.' };
  if (job.status === 'approved') return { error: 'This job is already complete and locked.' };
  if (!WORKABLE_STATUSES.includes(job.status)) return { error: 'This job cannot be submitted right now.' };

  const observations = String(formData.get('observations') || '').trim();
  if (!observations) return { error: 'Please add your observations before submitting.' };

  const answersResult = extractVisitAnswers(formData);
  if ('error' in answersResult) return { error: answersResult.error };

  const { count } = await supabase
    .from('monitoring_media')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);
  if (!count || count === 0) return { error: 'Please upload at least one photo or video before submitting.' };

  // Redesign 2026-09 — GPS check ("warn, never block": see lib/geo.ts and
  // AgentCaptureScreen.tsx). The distance is only ever recorded here, at
  // submit time — never required, never blocks submission.
  const gpsDistanceRaw = formData.get('gps_distance_meters');
  const gpsDistanceMeters = gpsDistanceRaw !== null && gpsDistanceRaw !== '' ? Number(gpsDistanceRaw) : null;

  const { error } = await supabase
    .from('monitoring_jobs')
    .update({
      status: 'submitted',
      observations,
      submitted_at: new Date().toISOString(),
      admin_feedback: null,
      gps_distance_meters: gpsDistanceMeters,
      flagged: gpsDistanceMeters !== null && gpsDistanceMeters > GPS_FLAG_THRESHOLD_METERS,
      ...answersResult.values,
    })
    .eq('id', jobId);
  if (error) return { error: error.message };

  revalidatePath('/agent/dashboard');
  revalidatePath(`/agent/jobs/${jobId}`);
  return { success: true };
}

// Lets the agent remove an upload before final submission.
export async function deleteJobMedia(jobId: string, mediaId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: job } = await supabase.from('monitoring_jobs').select('agent_id, status').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (job.agent_id !== userData.user.id) return { error: 'Not authorized.' };
  if (!WORKABLE_STATUSES.includes(job.status)) {
    return { error: 'Media can only be removed while the job is still in progress.' };
  }

  const { data: mediaRow } = await supabase
    .from('monitoring_media')
    .select('file_path, job_id')
    .eq('id', mediaId)
    .single();
  if (!mediaRow || mediaRow.job_id !== jobId) return { error: 'Media not found.' };

  const { error: deleteRowError } = await supabase.from('monitoring_media').delete().eq('id', mediaId);
  if (deleteRowError) return { error: deleteRowError.message };

  await supabase.storage.from('monitoring-media').remove([mediaRow.file_path]);

  revalidatePath(`/agent/jobs/${jobId}`);
  return { success: true };
}

export async function getMediaUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('monitoring-media').createSignedUrl(filePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
