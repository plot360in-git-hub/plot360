'use server';

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: the WhatsApp visit-report
// message links straight to app/properties/[id]/visit-report/[jobId]/pdf,
// a cookie-authenticated route gated by RLS. WhatsApp's in-app browser is a
// separate, cookie-less webview, so even a customer who's logged in on
// their phone's regular browser isn't recognized there — the link just
// opened "This visit report is not available." This module mirrors
// components/agent/magic-link.actions.ts's token pattern for the customer
// side: a long random token that IS the credential, checked by a
// service-role client that bypasses RLS entirely. See
// ARCHITECTURE.md #62 and the visit_report_tokens table in
// supabase/schema.sql.
//
// Unlike the agent's 7-day upload link, there's no natural point at which
// an approved job's report should stop being reachable — it's a permanent
// record, not a task in progress. So validity is set far longer here
// rather than tied to job status changes.

import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getVisitReportPdfData } from '@/components/properties/monitoring/monitoring.actions';

const RECORD_LINK_VALIDITY_DAYS = 1095; // ~3 years — see note above.

function generateToken() {
  return randomBytes(24).toString('base64url');
}

// --- Admin-side: create/fetch a token for a job (normal authenticated client) ---
// Called from approveSubmission (components/admin/review-decisions.actions.ts)
// right after a job is approved. Not surfaced through any customer-facing
// form, but re-checks admin status itself in case it's ever called from
// somewhere else — same defensive pattern as getOrCreateUploadToken.
export async function getOrCreateReportToken(jobId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { error: 'Only an admin can do this.' };

  const { data: job } = await supabase.from('monitoring_jobs').select('status').eq('id', jobId).single();
  if (!job) return { error: 'Job not found.' };
  if (!['approved', 'ec_pending'].includes(job.status)) {
    return { error: 'This visit is not yet approved.' };
  }

  const { data: existing } = await supabase
    .from('visit_report_tokens')
    .select('token, expires_at')
    .eq('job_id', jobId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { success: true, token: existing.token, expiresAt: existing.expires_at };

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RECORD_LINK_VALIDITY_DAYS);

  const { error } = await supabase.from('visit_report_tokens').insert({
    job_id: jobId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (error) return { error: error.message };

  return { success: true, token, expiresAt: expiresAt.toISOString() };
}

// --- Public magic-link flow: no session, token IS the credential ---
// Kept unexported — it hands back a live service-role client, which is
// safe to pass to other server-side functions in this same request but
// must never cross a Server Action boundary to a client component. Only
// getVisitReportPdfDataByToken below (which returns plain data) is
// exported for that flow.
async function validateReportToken(token: string) {
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from('visit_report_tokens')
    .select('job_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) return { valid: false as const, reason: 'This link is invalid.' };
  if (new Date(tokenRow.expires_at) < new Date()) {
    return { valid: false as const, reason: 'This link has expired.' };
  }

  const { data: job } = await admin.from('monitoring_jobs').select('id, status').eq('id', tokenRow.job_id).single();
  if (!job || !['approved', 'ec_pending'].includes(job.status)) {
    return { valid: false as const, reason: 'This visit report is not available.' };
  }

  return { valid: true as const, admin, jobId: job.id as string };
}

// Used by app/r/[token]/route.ts — validates the token, then reuses the
// same PDF-data fetch every authenticated caller uses
// (getVisitReportPdfData), passing the service-role client through so it
// bypasses RLS instead of relying on a session that a WhatsApp visitor
// never has.
export async function getVisitReportPdfDataByToken(token: string) {
  const check = await validateReportToken(token);
  if (!check.valid) return { error: check.reason };

  const data = await getVisitReportPdfData(check.jobId, check.admin);
  if (!data) return { error: 'This visit report is not available.' };

  return { success: true as const, data };
}
