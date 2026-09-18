'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { verifyTurnstileToken } from '@/components/auth/turnstile.server';

// Agents sign up through the same Supabase Auth pool as everyone else —
// what makes them an "agent" is completing /agent/onboarding afterward,
// which creates the agent_profiles row. Reuses the same email-verification
// flow as customer signup.
//
// Redesign 2026-09 (follow-up, round 22) — kept intact but no longer
// called by AgentSignupForm.tsx, which now calls agentSignUpAndRegister
// (below) instead — same account-creation call, plus name/mobile/
// documents in the same submission. Left here rather than removed, same
// "don't delete working code, just stop wiring it" rule as the rest of
// this redesign.
export async function agentSignUp(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const confirmPassword = String(formData.get('confirmPassword'));
  const captchaToken = formData.get('cf-turnstile-response') as string | null;

  const captchaCheck = await verifyTurnstileToken(captchaToken);
  if (!captchaCheck.success) return { error: captchaCheck.error };

  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agent/login` },
  });

  if (error) return { error: error.message };

  // Same anti-enumeration behavior as customer signup: Supabase returns
  // success with no error even for an existing email, but the identities
  // array comes back empty when no new account was actually created.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists.', alreadyExists: true };
  }

  return { success: true, email };
}

const SIGNUP_DOC_LABELS: Record<'driving_license' | 'secondary_id', string> = {
  driving_license: 'Driving License',
  secondary_id: 'Secondary ID',
};

// Redesign 2026-09 (follow-up, round 22) — the new combined Agent signup
// screen (design_handoff_plot360_redesign, "Plot360 Field Agent" mocks):
// one screen creates the auth account AND the minimal profile (name,
// mobile, optional documents) together, replacing the old two-step
// signup-then-separate-full-KYC-form flow. SRO is deliberately not
// collected here anymore — it now lives only on the Profile & SRO screen
// (AgentProfileEditForm.tsx), settable any time before an agent needs to
// be matched to jobs. Home address is no longer collected anywhere in the
// agent flow — the new mocks never show it, and admin's own review screen
// (AgentVerificationDetail.tsx) never displayed it either.
//
// Uses the service-role admin client for the profile/agent_profiles/
// document writes (same "legitimately privileged write after manual
// authorization" pattern as purchaseVisitCredits' UPI branch,
// components/payments/visitCredits.actions.ts) because Supabase may not
// hand back a session immediately after auth.signUp() — email
// confirmation, if the project has it on, still gates that, unchanged —
// so this still lets a brand-new agent's name/mobile/docs be saved right
// away instead of waiting on a second authenticated round-trip once they
// confirm and log in.
export async function agentSignUpAndRegister(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const captchaToken = formData.get('cf-turnstile-response') as string | null;
  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const phoneCountryCode = String(formData.get('phone_country_code') || '').trim() || '+91';
  const phoneNumber = String(formData.get('phone_number') || '').trim();

  const captchaCheck = await verifyTurnstileToken(captchaToken);
  if (!captchaCheck.success) return { error: captchaCheck.error };

  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (!firstName || !lastName) return { error: 'First and last name are required.' };
  if (!phoneNumber) return { error: 'Mobile number is required.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/agent/login` },
  });
  if (error) return { error: error.message };
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists.', alreadyExists: true };
  }
  if (!data.user) return { error: 'Sign up did not return a user — please try again.' };
  const userId = data.user.id;

  const { createAdminClient } = await import('@/lib/supabase/admin');
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'Agent registration is not configured on the server yet (missing SUPABASE_SERVICE_ROLE_KEY).' };
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email,
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    phone_country_code: phoneCountryCode,
    is_agent: true,
  });
  if (profileError) return { error: profileError.message };

  const { error: agentError } = await admin.from('agent_profiles').upsert({ id: userId, status: 'pending' });
  if (agentError) return { error: agentError.message };

  const missingDocs: string[] = [];
  for (const docType of ['driving_license', 'secondary_id'] as const) {
    const file = formData.get(docType) as File | null;
    if (!file || file.size === 0) {
      missingDocs.push(SIGNUP_DOC_LABELS[docType]);
      continue;
    }
    const path = `${userId}/${docType}-${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from('agent-documents')
      .upload(path, fileBuffer, { upsert: true, contentType: file.type || 'application/octet-stream' });
    if (uploadError) return { error: `${SIGNUP_DOC_LABELS[docType]} upload failed: ${uploadError.message}` };
    const { error: docError } = await admin
      .from('agent_documents')
      .upsert({ agent_id: userId, doc_type: docType, file_path: path }, { onConflict: 'agent_id,doc_type' });
    if (docError) return { error: docError.message };
  }

  // Best-effort welcome WhatsApp — same 'sent'-the-moment-it's-logged
  // shape as every other automatic status-change message (see
  // components/admin/review-decisions.actions.ts / whatsapp-log.actions.ts's
  // own note: there's no real send API to confirm delivery against).
  // Written directly via the admin client rather than through
  // logWhatsAppMessage — that helper uses the caller's own session, and
  // whatsapp_messages' RLS only allows admin writes; there is no admin
  // session here, just a brand-new agent signing up, so this needs the
  // same service-role client already in scope. Never blocks signup.
  try {
    const { buildAgentWelcomeMessage } = await import('./agentDisplay');
    await admin.from('whatsapp_messages').insert({
      related_entity_type: 'agent_profile',
      related_entity_id: userId,
      recipient_phone: `${phoneCountryCode}${phoneNumber}`,
      body: buildAgentWelcomeMessage(firstName, missingDocs),
      state: 'sent',
      sent_by: null,
    });
  } catch {
    // best-effort only
  }

  // A session comes back immediately only if the Supabase project has
  // email confirmation turned off; otherwise this matches agentSignUp's
  // existing behavior above (show a "check your email" interstitial).
  if (data.session) redirect('/agent/dashboard');
  return { success: true as const, email };
}

export async function agentLogIn(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  const { data: userData } = await supabase.auth.getUser();
  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('status')
    .eq('id', userData.user!.id)
    .maybeSingle();

  if (!agentProfile) redirect('/agent/onboarding');

  // Redesign 2026-09 — admin console: a banned agent (components/admin/
  // agent-bans.actions.ts, toggleAgentBan) can still sign in with
  // correct credentials but must not reach the dashboard — signed out
  // again immediately, same pattern as admin-auth.actions.ts's adminLogIn.
  const { data: ban } = await supabase
    .from('bans')
    .select('id')
    .eq('subject_type', 'agent')
    .eq('subject_id', userData.user!.id)
    .eq('active', true)
    .maybeSingle();
  if (ban) {
    await supabase.auth.signOut();
    return { error: 'This account has been disabled. Contact Plot360 support.' };
  }

  redirect('/agent/dashboard');
}

// Distinguishes "not signed in" from "signed in but registration incomplete
// or awaiting verification" so pages can route accordingly.
type AgentGateStatus = 'unauthenticated' | 'needs_onboarding' | 'pending' | 'rejected' | 'verified' | 'banned';

export async function getAgentGateStatus(): Promise<AgentGateStatus> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 'unauthenticated';

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!agentProfile) return 'needs_onboarding';

  // Redesign 2026-09 — admin console: checked after onboarding so a
  // banned agent (even a still-'pending' one) is routed to the
  // "disabled" message rather than the ordinary status screens.
  const { data: ban } = await supabase
    .from('bans')
    .select('id')
    .eq('subject_type', 'agent')
    .eq('subject_id', userData.user.id)
    .eq('active', true)
    .maybeSingle();
  if (ban) return 'banned';

  return agentProfile.status;
}
