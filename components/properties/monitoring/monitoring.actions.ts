'use server';

import { createClient } from '@/lib/supabase/server';

// Read-only for the property owner — RLS (monitoring_jobs_select_owner)
// already scopes this to their own properties. Deliberately returns only
// status/progress/dates, not the agent's raw uploaded media — admin
// reviews those first; the customer sees the outcome, not the raw evidence.
export async function getAllMonitoringForCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select('id, status, property_id, assigned_at, accepted_at, submitted_at, decided_at, properties(id, property_name)')
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

export async function getMonitoringHistoryForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_jobs')
    .select('id, status, assigned_at, accepted_at, submitted_at, decided_at')
    .eq('property_id', propertyId)
    .order('assigned_at', { ascending: false });
  return data ?? [];
}

// Once a job is approved, its media becomes downloadable by the property
// owner — this is the only point at which the customer sees the agent's
// raw uploads, and only for jobs an admin has actually signed off on.
export async function getApprovedMonitoringMedia(jobId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('monitoring_media')
    .select('*')
    .eq('job_id', jobId)
    .order('uploaded_at', { ascending: true });
  return data ?? [];
}

export async function getMonitoringMediaDownloadUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('monitoring-media').createSignedUrl(filePath, 60 * 10, { download: true });
  if (error) return null;
  return data.signedUrl;
}

// The Digital EC is uploaded by admin (not the customer) once received
// externally, and belongs here in the monitoring/verification section
// rather than the customer's own "Uploaded Documents" list.
export async function getEcDigitalCopyForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('property_documents')
    .select('file_path')
    .eq('property_id', propertyId)
    .eq('doc_type', 'ec_digital_copy')
    .maybeSingle();
  if (!data) return null;
  const { data: signed } = await supabase.storage.from('property-documents').createSignedUrl(data.file_path, 60 * 10, { download: true });
  return { filePath: data.file_path, url: signed?.signedUrl ?? null };
}
