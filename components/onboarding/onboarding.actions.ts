'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Address } from '@/types/database.types';

function addressFromForm(formData: FormData, prefix: 'current' | 'permanent'): Address {
  return {
    street: String(formData.get(`${prefix}_street`) ?? ''),
    city: String(formData.get(`${prefix}_city`) ?? ''),
    state: String(formData.get(`${prefix}_state`) ?? ''),
    zip: String(formData.get(`${prefix}_zip`) ?? ''),
    country: String(formData.get(`${prefix}_country`) ?? ''),
  };
}

// Handles both Customer Registration wireframe pages in one submit:
// identity fields + addresses (page 1), security question + "how did you
// hear about us" (page 2).
export async function saveCustomerRegistration(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: 'Not signed in.' };

  let identityProofUrl: string | null = null;
  const identityFile = formData.get('identity_proof') as File | null;
  if (identityFile && identityFile.size > 0) {
    const path = `${userData.user.id}/${identityFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('identity-proofs')
      .upload(path, identityFile, { upsert: true });
    if (uploadError) return { error: `Identity proof upload failed: ${uploadError.message}` };
    identityProofUrl = path;
  }

  const payload = {
    id: userData.user.id,
    email: userData.user.email!,
    username: String(formData.get('username') || ''),
    first_name: String(formData.get('first_name') || ''),
    middle_name: String(formData.get('middle_name') || '') || null,
    last_name: String(formData.get('last_name') || ''),
    date_of_birth: String(formData.get('date_of_birth') || '') || null,
    gender: (String(formData.get('gender') || '') || null) as 'male' | 'female' | 'other' | null,
    phone_country_code: String(formData.get('phone_country_code') || ''),
    phone_number: String(formData.get('phone_number') || ''),
    current_address: addressFromForm(formData, 'current'),
    permanent_address: addressFromForm(formData, 'permanent'),
    identity_proof_type: String(formData.get('identity_proof_type') || '') || null,
    ...(identityProofUrl ? { identity_proof_url: identityProofUrl } : {}),
    security_question_1: String(formData.get('security_question_1') || ''),
    security_answer_1: String(formData.get('security_answer_1') || ''),
    security_question_2: String(formData.get('security_question_2') || ''),
    security_answer_2: String(formData.get('security_answer_2') || ''),
    how_heard_about_us: String(formData.get('how_heard_about_us') || ''),
    terms_accepted_at: formData.get('terms_accepted') ? new Date().toISOString() : null,
    privacy_accepted_at: formData.get('privacy_accepted') ? new Date().toISOString() : null,
  };

  if (!payload.terms_accepted_at || !payload.privacy_accepted_at) {
    return { error: 'You must accept the Terms & Conditions and Privacy Policy.' };
  }

  const { error } = await supabase.from('profiles').upsert(payload);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { success: true };
}
