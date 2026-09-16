'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendNotificationEmail } from '@/lib/email';

// Redesign 2026-09 (follow-up, round 11) — Plot asked for the old Edit
// Profile page (address pair, identity proof, profile picture — none of
// it styled with .p360) to be rebuilt to match the redesigned onboarding
// form (CustomerRegistrationForm.tsx): same fields (name, country
// code + phone), plus email and — new — a password change, since a
// returning user editing their account needs both and neither belongs on
// the one-time signup form. Address/identity-proof/profile-picture
// handling is removed along with the UI that collected them; the
// underlying `profiles` columns are untouched and stay nullable.
export async function getMyProfile() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  if (!profile) return null;

  // Google/Facebook-only accounts have no password to change — Supabase
  // lists every linked sign-in method on the user's `identities` array, so
  // an 'email' entry there means they set a password at some point (either
  // at signup or later) and the change-password section should show.
  const hasPassword = (userData.user.identities ?? []).some((i) => i.provider === 'email');

  return { profile, hasPassword };
}

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const phoneCountryCode = String(formData.get('phone_country_code') || '').trim();
  const phoneNumber = String(formData.get('phone_number') || '').trim();
  if (!firstName || !lastName) return { error: 'First name and last name are required.' };
  if (!phoneCountryCode || !phoneNumber) return { error: 'A phone number is required.' };

  // Email lives in Supabase Auth, not just the profiles table. Changing it
  // here sends a confirmation link to the NEW address — the change only
  // takes effect once that's clicked, same as changing email anywhere else.
  const newEmail = String(formData.get('email') || '').trim();
  let emailChangeRequested = false;
  if (newEmail && newEmail !== userData.user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
    if (emailError) return { error: emailError.message };
    emailChangeRequested = true;
  }

  const patch = {
    first_name: firstName,
    middle_name: String(formData.get('middle_name') || '').trim() || null,
    last_name: lastName,
    phone_country_code: phoneCountryCode,
    phone_number: phoneNumber,
  };

  const { error } = await supabase.from('profiles').update(patch).eq('id', userData.user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/profile/edit');
  return { success: true, emailChangeRequested };
}

// New — the old edit-profile page had no way to change a password at all
// while logged in (the only path anywhere in the app was the forgot-
// password email link). Re-verifies identity by re-signing-in with the
// CURRENT password before allowing the change, and emails a "your
// password was changed" notice afterward, same as the reset-password flow
// (components/auth/auth.actions.ts, updatePassword) — so changing a
// password is equally confirmed whether it happens from a reset link or
// from here.
export async function changeMyPassword(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !userData.user.email) return { error: 'Not signed in.' };

  const currentPassword = String(formData.get('current_password') || '');
  const newPassword = String(formData.get('new_password') || '');
  const confirmPassword = String(formData.get('confirm_password') || '');

  if (!currentPassword) return { error: 'Enter your current password.' };
  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.' };
  if (newPassword !== confirmPassword) return { error: 'New passwords do not match.' };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: userData.user.email,
    password: currentPassword,
  });
  if (reauthError) return { error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  await sendNotificationEmail({
    to: userData.user.email,
    subject: 'Your Plot360 password was changed',
    heading: 'Password changed',
    accent: '#b3261e',
    bodyLines: ['This confirms your Plot360 account password was just changed.', "If this wasn't you, contact support immediately."],
  });

  return { success: true };
}
