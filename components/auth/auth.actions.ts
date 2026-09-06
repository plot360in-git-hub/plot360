'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Matches the Signup wireframe: username(email), password, re-enter password, captcha.
// Supabase Auth owns the users table — we just create the row and let the
// verification-email screen ("A verification email has been sent to...") do the rest.
export async function signUp(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));
  const confirmPassword = String(formData.get('confirmPassword'));

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
    return { error: 'An account with this email already exists. Please log in instead.' };
  }

  return { success: true, email };
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
