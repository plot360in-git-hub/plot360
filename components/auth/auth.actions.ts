'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { verifyTurnstileToken } from './turnstile.server';

// Matches the Signup wireframe: username(email), password, re-enter password, captcha.
export async function signUp(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const confirmPassword = String(formData.get('confirmPassword'));
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

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { error: 'An account with this email already exists. Please log in instead.' };
  }

  return { success: true, email };
}

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

  redirect('/dashboard');
}