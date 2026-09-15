'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { verifyTurnstileToken } from './turnstile.server';
import { sendNotificationEmail } from '@/lib/email';

// Matches the Signup wireframe: username(email), password, re-enter password, captcha.
// Supabase Auth owns the users table — we just create the row and let the
// verification-email screen ("A verification email has been sent to...") do the rest.
//
// Redesign 2026-09 (follow-up) — also used by the new AuthScreen.tsx, whose
// design mock has no "re-enter password" field and adds an optional phone
// number instead. Both are handled here rather than forking a second
// signUp: confirmPassword falls back to password when absent (so this
// check is a no-op for the new screen, unchanged for the old SignupForm),
// and phone is a new, optional, purely-additive parameter.
export async function signUp(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const confirmPasswordRaw = formData.get('confirmPassword');
  const confirmPassword = confirmPasswordRaw !== null ? String(confirmPasswordRaw) : password;
  const phone = formData.get('phone');
  const captchaToken = formData.get('cf-turnstile-response') as string | null;

  const captchaCheck = await verifyTurnstileToken(captchaToken);
  if (!captchaCheck.success) return { error: captchaCheck.error };

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });

  if (error) return { error: error.message };

  // Supabase deliberately returns success (no error) even when the email
  // already exists, to avoid letting an attacker enumerate registered
  // emails. When that happens, no new verification email is actually
  // sent and the returned user has an empty identities array — that's
  // the documented signal to detect this case ourselves.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists.', alreadyExists: true };
  }

  // Best-effort: the on_auth_user_created trigger already created a stub
  // profiles row (supabase/schema.sql, handle_new_user) — this just fills
  // in one column on it. Email/password signup with confirmation required
  // has no active session yet, so a normal (RLS-scoped) client can't
  // necessarily write this; the admin client is used since data.user.id
  // came straight back from the signUp call above, not from client input.
  // A failure here never blocks the signup that already succeeded.
  if (phone && data.user) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      await createAdminClient().from('profiles').update({ phone_number: String(phone) }).eq('id', data.user.id);
    } catch {
      // SUPABASE_SERVICE_ROLE_KEY not set, or the update failed — the
      // phone number can still be added later via onboarding/profile edit.
    }
  }

  return { success: true, email };
}

// New — the redesigned Confirm-email screen's "resend" action (the mock's
// own "I've confirmed — continue" button can't be made real, see
// ConfirmEmailScreen.tsx; this is its honest replacement).
export async function resendConfirmationEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { success: true };
}

// Matches the Home wireframe's login box: username, password, Login / Signup / forgot links.
export async function logIn(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect('/dashboard');
}

export async function forgotPassword(formData: FormData) {
  const email = String(formData.get('email'));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// Called from the reset-password page after the user clicks the emailed
// link (which establishes a temporary "recovery" session) and enters a
// new password. Requires an active session — see app/auth/reset-password.
export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password'));
  const confirmPassword = String(formData.get('confirmPassword'));

  if (password !== confirmPassword) return { error: 'Passwords do not match.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'This reset link has expired or already been used. Please request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  if (userData.user.email) {
    await sendNotificationEmail({
      to: userData.user.email,
      subject: 'Your Plot360 password was changed',
      heading: 'Password changed',
      accent: '#b3261e',
      bodyLines: [
        'This confirms your Plot360 account password was just changed.',
        "If this wasn't you, contact support immediately.",
      ],
    });
  }

  const { data: agentProfile } = await supabase.from('agent_profiles').select('id').eq('id', userData.user.id).maybeSingle();
  redirect(agentProfile ? '/agent/dashboard' : '/dashboard');
}
