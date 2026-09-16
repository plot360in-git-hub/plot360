'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Redesign 2026-09 (follow-up, round 10) — this used to also handle
// address (current + permanent), date of birth, gender, a profile
// picture upload, an identity-proof upload and two security questions,
// matching the old two-step "Customer Registration" wizard. Plot asked
// for that wizard to be replaced by a single-page form collecting only
// name, phone and the two Terms/Privacy acceptances — see
// CustomerRegistrationForm.tsx. None of the dropped fields are read
// anywhere else in the app today; the `profiles` columns for them are
// untouched and stay nullable, so nothing downstream breaks. If a later
// phase needs address/identity-proof info, the established pattern is to
// have a representative collect it after signup, the same way property
// ownership documents are collected post-registration.
export async function saveCustomerRegistration(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Not signed in.' };

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const phoneCountryCode = String(formData.get('phone_country_code') || '').trim();
  const phoneNumber = String(formData.get('phone_number') || '').trim();
  const termsAccepted = Boolean(formData.get('terms_accepted'));
  const privacyAccepted = Boolean(formData.get('privacy_accepted'));

  if (!firstName || !lastName) return { error: 'First and last name are required.' };
  if (!phoneCountryCode || !phoneNumber) return { error: 'A phone number is required.' };
  if (!termsAccepted || !privacyAccepted) {
    return { error: 'You must accept the Terms & Conditions and Privacy Policy.' };
  }

  const payload = {
    id: userData.user.id,
    email: userData.user.email!,
    first_name: firstName,
    middle_name: String(formData.get('middle_name') || '').trim() || null,
    last_name: lastName,
    phone_country_code: phoneCountryCode,
    phone_number: phoneNumber,
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
