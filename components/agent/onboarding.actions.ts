'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Address } from '@/types/database.types';

// Completes agent registration: profile fields (shared with the profiles
// table) + the agent_profiles row (status starts 'pending') + the two
// mandatory ID documents. Also handles resubmission after a rejection —
// upserting agent_profiles and resetting status back to 'pending'.
export async function completeAgentRegistration(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const phoneNumber = String(formData.get('phone_number') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const street = String(formData.get('street') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const district = String(formData.get('district') || '').trim();
  const state = String(formData.get('state') || '').trim();
  const zip = String(formData.get('zip') || '').trim();

  if (!firstName || !lastName) return { error: 'First and last name are required.' };
  if (!phoneNumber) return { error: 'Phone number is required.' };
  if (!email) return { error: 'Email is required.' };
  if (!street) return { error: 'Street address is required.' };
  if (!city) return { error: 'City is required.' };
  if (!district) return { error: 'District is required.' };
  if (!state) return { error: 'State is required.' };
  if (!zip) return { error: 'Zip / Postal code is required.' };

  const homeAddress: Address & { district?: string } = { street, city, district, state, zip };

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('profile_picture_url')
    .eq('id', userData.user.id)
    .maybeSingle();

  let profilePictureUrl: string | undefined;
  const pictureFile = formData.get('profile_picture') as File | null;
  if (!existingProfile?.profile_picture_url && (!pictureFile || pictureFile.size === 0)) {
    return { error: 'A photo of the agent is required.' };
  }
  if (pictureFile && pictureFile.size > 0) {
    const path = `${userData.user.id}/agent-photo-${Date.now()}-${pictureFile.name}`;
    const fileBuffer = await pictureFile.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, fileBuffer, { upsert: true, contentType: pictureFile.type || 'image/jpeg' });
    if (uploadError) {
      console.error('AVATAR UPLOAD ERROR (full object):', JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError), 2));
      return {
        error: `Photo upload failed: ${uploadError.message}. If this persists, check in Supabase that the "avatars" storage bucket exists (Storage → Buckets) and that today's schema.sql / bucket SQL has been run.`,
      };
    }
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    profilePictureUrl = publicUrlData.publicUrl;

    // Clean up the old avatar file now that the new one is safely uploaded.
    if (existingProfile?.profile_picture_url) {
      const oldPath = existingProfile.profile_picture_url.split('/avatars/')[1];
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
    }
  }

  const profilePatch: Record<string, unknown> = {
    id: userData.user.id,
    email,
    first_name: firstName,
    middle_name: String(formData.get('middle_name') || '').trim() || null,
    last_name: lastName,
    phone_number: phoneNumber,
    phone_country_code: String(formData.get('phone_country_code') || ''),
    current_address: homeAddress,
    is_agent: true,
  };
  if (profilePictureUrl) profilePatch.profile_picture_url = profilePictureUrl;

  const { error: profileError } = await supabase.from('profiles').upsert(profilePatch);
  if (profileError) return { error: profileError.message };

  // Create/update the agent_profiles row BEFORE uploading documents —
  // agent_documents.agent_id has a foreign key to agent_profiles(id), so on
  // a first-time registration that row must exist first or the document
  // inserts below fail with a foreign key violation. Resubmitting after a
  // rejection also resets status back to 'pending' here.
  const { error: agentError } = await supabase.from('agent_profiles').upsert({
    id: userData.user.id,
    status: 'pending',
    admin_notes: null,
  });
  if (agentError) return { error: agentError.message };

  async function uploadDoc(field: string, docType: 'driving_license' | 'secondary_id') {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) return;

    const { data: existing } = await supabase
      .from('agent_documents')
      .select('file_path')
      .eq('agent_id', userData.user!.id)
      .eq('doc_type', docType)
      .maybeSingle();

    const path = `${userData.user!.id}/${docType}-${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('agent-documents')
      .upload(path, fileBuffer, { upsert: true, contentType: file.type || 'application/octet-stream' });
    if (uploadError) throw new Error(uploadError.message);

    const { error: docError } = await supabase
      .from('agent_documents')
      .upsert({ agent_id: userData.user!.id, doc_type: docType, file_path: path }, { onConflict: 'agent_id,doc_type' });
    if (docError) throw new Error(docError.message);

    // Clean up the old file now that the replacement is safely saved,
    // so a rejected/re-uploaded document doesn't leave the old one
    // sitting around for admin to see alongside the new one.
    if (existing?.file_path && existing.file_path !== path) {
      await supabase.storage.from('agent-documents').remove([existing.file_path]);
    }
  }

  const { data: existingDocs } = await supabase
    .from('agent_documents')
    .select('doc_type')
    .eq('agent_id', userData.user.id);
  const hasDL = (existingDocs ?? []).some((d) => d.doc_type === 'driving_license');
  const hasSecondaryId = (existingDocs ?? []).some((d) => d.doc_type === 'secondary_id');

  const dlFile = formData.get('driving_license') as File | null;
  const secondaryIdFile = formData.get('secondary_id') as File | null;
  if (!hasDL && (!dlFile || dlFile.size === 0)) return { error: 'Driving License is required.' };
  if (!hasSecondaryId && (!secondaryIdFile || secondaryIdFile.size === 0)) {
    return { error: 'A second Government ID (Aadhar / PAN / other) is required.' };
  }

  try {
    await uploadDoc('driving_license', 'driving_license');
    await uploadDoc('secondary_id', 'secondary_id');
  } catch (e: any) {
    return { error: e.message };
  }

  redirect('/agent/dashboard');
}

// For an already-verified agent: lets them update only phone/email/address/
// photo (not name or ID documents). Submitting sends them back for
// reverification — the same "resubmission" pattern as a rejection, just
// triggered by the agent themself rather than an admin decision.
export async function updateAgentContactInfo(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const phoneNumber = String(formData.get('phone_number') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const street = String(formData.get('street') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const district = String(formData.get('district') || '').trim();
  const state = String(formData.get('state') || '').trim();
  const zip = String(formData.get('zip') || '').trim();

  if (!phoneNumber) return { error: 'Phone number is required.' };
  if (!email) return { error: 'Email is required.' };
  if (!street || !city || !district || !state || !zip) {
    return { error: 'Please complete the full address.' };
  }

  const homeAddress: Address & { district?: string } = { street, city, district, state, zip };

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('profile_picture_url')
    .eq('id', userData.user.id)
    .maybeSingle();

  let profilePictureUrl: string | undefined;
  const pictureFile = formData.get('profile_picture') as File | null;
  if (pictureFile && pictureFile.size > 0) {
    const path = `${userData.user.id}/agent-photo-${Date.now()}-${pictureFile.name}`;
    const fileBuffer = await pictureFile.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, fileBuffer, { upsert: true, contentType: pictureFile.type || 'image/jpeg' });
    if (uploadError) return { error: `Photo upload failed: ${uploadError.message}` };
    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    profilePictureUrl = publicUrlData.publicUrl;
    if (existingProfile?.profile_picture_url) {
      const oldPath = existingProfile.profile_picture_url.split('/avatars/')[1];
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath]);
    }
  }

  // Email lives in Supabase Auth — changing it sends a confirmation link
  // to the new address, same as the customer profile edit flow.
  let emailChangeRequested = false;
  if (email !== userData.user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) return { error: emailError.message };
    emailChangeRequested = true;
  }

  const patch: Record<string, unknown> = {
    phone_number: phoneNumber,
    phone_country_code: String(formData.get('phone_country_code') || ''),
    current_address: homeAddress,
  };
  if (profilePictureUrl) patch.profile_picture_url = profilePictureUrl;

  const { error: profileError } = await supabase.from('profiles').update(patch).eq('id', userData.user.id);
  if (profileError) return { error: profileError.message };

  const { error: agentError } = await supabase
    .from('agent_profiles')
    .update({ status: 'pending', admin_notes: null })
    .eq('id', userData.user.id);
  if (agentError) return { error: agentError.message };

  return { success: true, emailChangeRequested };
}

export async function getMyAgentDocumentUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('agent-documents').createSignedUrl(filePath, 60 * 5);
  if (error) return null;
  return data.signedUrl;
}

export async function getMyAgentProfile() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: profile }, { data: agentProfile }, { data: documents }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userData.user.id).single(),
    supabase.from('agent_profiles').select('*').eq('id', userData.user.id).maybeSingle(),
    supabase.from('agent_documents').select('doc_type, file_path').eq('agent_id', userData.user.id),
  ]);

  return { profile, agentProfile, documents: documents ?? [] };
}
