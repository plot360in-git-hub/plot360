'use server';

import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { extractVisitAnswers } from '@/lib/visitReportQuestions';

const TOKEN_VALIDITY_DAYS = 7;

function generateToken() {
  return randomBytes(24).toString('base64url');
}

// --- Admin-side: create/fetch a token for a job (normal authenticated client) ---

export async function getOrCreateUploadToken(jobId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { error: 'Only an admin can do this.' };

  const { data: job } = await supabase.from('monitoring_jobs').select('status').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (job.status === 'approved') return { error: "Can't create an upload link for a completed job." };

  const { data: existing } = await supabase
    .from('monitoring_upload_tokens')
    .select('token, expires_at')
    .eq('job_id', jobId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { success: true, token: existing.token, expiresAt: existing.expires_at };

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_VALIDITY_DAYS);

  const { error } = await supabase.from('monitoring_upload_tokens').insert({
    job_id: jobId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return { error: error.message };

  return { success: true, token, expiresAt: expiresAt.toISOString() };
}

// Called when an admin approves a job — immediately revokes any
// outstanding upload links regardless of their 7-day expiry, per the
// requirement that the agent loses access the moment work is confirmed.
export async function revokeUploadTokensForJob(jobId: string) {
  const supabase = await createClient();
  await supabase.from('monitoring_upload_tokens').delete().eq('job_id', jobId);
}

// --- Public magic-link flow: no session, token IS the credential ---
// Every function below re-validates the token itself (existence, not
// expired, job not yet approved) before touching any data, since the
// service-role client bypasses RLS entirely.

async function validateToken(token: string) {
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from('monitoring_upload_tokens')
    .select('job_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) return { valid: false as const, reason: 'This link is invalid.' };
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { valid: false as const, reason: 'This link has expired.' };
  }

  const { data: job } = await admin.from('monitoring_jobs').select('*').eq('id', tokenRow.job_id).single();
  if (!job) return { valid: false as const, reason: 'Job not found.' };
  if (job.status === 'approved' || job.status === 'ec_pending') {
    return { valid: false as const, reason: 'This job is already complete — the upload link has been closed.' };
  }
  if (job.status === 'submitted') {
    return { valid: false as const, reason: 'You already submitted this visit — it\u2019s awaiting admin review, so the link is closed until then.' };
  }

  return { valid: true as const, admin, job };
}

export async function getJobByToken(token: string) {
  const check = await validateToken(token);
  if (!check.valid) return { error: check.reason };

  const { data: property } = await check.admin
    .from('properties')
    .select('id, property_name, plot_size, plot_size_unit, street_address, village_town, district, state, plot_gps_coordinate, google_map_lat, google_map_lng, near_by_landmark')
    .eq('id', check.job.property_id)
    .single();

  const { data: media } = await check.admin
    .from('monitoring_media')
    .select('*')
    .eq('job_id', check.job.id)
    .order('uploaded_at', { ascending: true });

  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data } = await check.admin.storage.from('monitoring-media').createSignedUrl(m.file_path, 60 * 10);
      return { ...m, url: data?.signedUrl ?? null };
    })
  );

  return { success: true, job: check.job, property, media: mediaWithUrls };
}

export async function uploadMediaByToken(token: string, formData: FormData) {
  const check = await validateToken(token);
  if (!check.valid) return { error: check.reason };
  if (check.job.status === 'submitted') return { error: 'Already submitted — waiting on admin review.' };

  const files = formData.getAll('media') as File[];
  if (files.length === 0) return { error: 'No files selected.' };

  for (const file of files) {
    if (file.size === 0) continue;
    const path = `${check.job.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await check.admin.storage.from('monitoring-media').upload(path, file);
    if (uploadError) return { error: uploadError.message };
    const mediaType = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'photo' : 'document';
    const { error: insertError } = await check.admin
      .from('monitoring_media')
      .insert({ job_id: check.job.id, media_type: mediaType, file_path: path });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/m/${token}`);
  return { success: true };
}

export async function deleteMediaByToken(token: string, mediaId: string) {
  const check = await validateToken(token);
  if (!check.valid) return { error: check.reason };
  if (check.job.status === 'submitted') return { error: 'Already submitted — waiting on admin review.' };

  const { data: mediaRow } = await check.admin
    .from('monitoring_media')
    .select('file_path, job_id')
    .eq('id', mediaId)
    .single();
  if (!mediaRow || mediaRow.job_id !== check.job.id) return { error: 'Media not found.' };

  await check.admin.from('monitoring_media').delete().eq('id', mediaId);
  await check.admin.storage.from('monitoring-media').remove([mediaRow.file_path]);

  revalidatePath(`/m/${token}`);
  return { success: true };
}

export async function submitByToken(token: string, formData: FormData) {
  const check = await validateToken(token);
  if (!check.valid) return { error: check.reason };
  if (check.job.status === 'submitted') return { error: 'Already submitted — waiting on admin review.' };

  const observations = String(formData.get('observations') || '').trim();
  if (!observations) return { error: 'Please add your observations before submitting.' };

  const answersResult = extractVisitAnswers(formData);
  if ('error' in answersResult) return { error: answersResult.error };

  const { count } = await check.admin
    .from('monitoring_media')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', check.job.id);
  if (!count || count === 0) return { error: 'Please upload at least one photo or video before submitting.' };

  const { error } = await check.admin
    .from('monitoring_jobs')
    .update({
      status: 'submitted',
      observations,
      submitted_at: new Date().toISOString(),
      admin_feedback: null,
      ...answersResult.values,
    })
    .eq('id', check.job.id);
  if (error) return { error: error.message };

  revalidatePath(`/m/${token}`);
  revalidatePath('/admin/monitoring');
  return { success: true };
}
