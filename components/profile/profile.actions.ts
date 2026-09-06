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

export async function getMyProfile() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
  return data;
}

export async function updateMyProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const sameAsCurrent = formData.get('same_as_current') === 'on';
  const currentAddress = addressFromForm(formData, 'current');
  const permanentAddress = sameAsCurrent ? currentAddress : addressFromForm(formData, 'permanent');

  // Profile picture: upload if a new file was chosen, otherwise leave as-is.
  let profilePictureUrl: string | undefined;
  const pictureFile = formData.get('profile_picture') as File | null;
  if (pictureFile && pictureFile.size > 0) {
    const path = `${userData.user.id}/profile-${Date.now()}-${pictureFile.name}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, pictureFile, { upsert: true });
    if (uploadError) return { error: `Profile picture upload failed: ${uploadError.message}` };
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    profilePictureUrl = publicUrlData.publicUrl;
  }

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

  const patch: Record<string, unknown> = {
    first_name: String(formData.get('first_name') || '').trim(),
    middle_name: String(formData.get('middle_name') || '').trim() || null,
    last_name: String(formData.get('last_name') || '').trim(),
    phone_country_code: String(formData.get('phone_country_code') || ''),
    phone_number: String(formData.get('phone_number') || ''),
    current_address: currentAddress,
    permanent_address: permanentAddress,
  };
  if (!patch.first_name || !patch.last_name) return { error: 'First name and last name are required.' };
  if (profilePictureUrl) patch.profile_picture_url = profilePictureUrl;

  const { error } = await supabase.from('profiles').update(patch).eq('id', userData.user.id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/profile/edit');
  return { success: true, emailChangeRequested };
}
