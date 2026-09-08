'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { verifyTurnstileToken } from '@/components/auth/turnstile.server';

// Agents sign up through the same Supabase Auth pool as everyone else —
// what makes them an "agent" is completing /agent/onboarding afterward,
// which creates the agent_profiles row. Reuses the same email-verification
// flow as customer signup.
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
  redirect('/agent/dashboard');
}

// Distinguishes "not signed in" from "signed in but registration incomplete
// or awaiting verification" so pages can route accordingly.
type AgentGateStatus = 'unauthenticated' | 'needs_onboarding' | 'pending' | 'rejected' | 'verified';

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
  return agentProfile.status;
}
