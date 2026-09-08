'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { DocumentType } from '@/types/database.types';

function corner(formData: FormData, key: 'ne' | 'se' | 'nw' | 'sw') {
  const lat = formData.get(`${key}_lat`);
  const lng = formData.get(`${key}_lng`);
  if (!lat && !lng) return undefined;
  return { lat: lat ? Number(lat) : undefined, lng: lng ? Number(lng) : undefined };
}

const REQUIRED_STEP1_FIELDS: Array<[string, string]> = [
  ['property_name', 'Property Name'],
  ['property_type', 'Property Type'],
  ['plot_size', 'Plot Size'],
  ['village_town', 'City/Town/Village'],
  ['mandal_taluka', 'Mandal/Taluka'],
  ['district', 'District'],
  ['state', 'State'],
  ['sro_name', 'SRO Name'],
  ['sro_code', 'SRO Code'],
];

function validateStep1(formData: FormData): string | null {
  for (const [field, label] of REQUIRED_STEP1_FIELDS) {
    const value = String(formData.get(field) || '').trim();
    if (!value) return `${label} is required.`;
  }
  return null;
}

function step1Payload(formData: FormData) {
  return {
    property_name: String(formData.get('property_name') || ''),
    property_type: String(formData.get('property_type') || 'residential'),
    plot_size: Number(formData.get('plot_size')) || null,
    plot_shape: String(formData.get('plot_shape') || '') || null,
    description: String(formData.get('description') || ''),
    street_address: String(formData.get('street_address') || ''),
    local_area: String(formData.get('local_area') || ''),
    village_town: String(formData.get('village_town') || ''),
    postal_code: String(formData.get('postal_code') || ''),
    mandal_taluka: String(formData.get('mandal_taluka') || ''),
    district: String(formData.get('district') || ''),
    state: String(formData.get('state') || ''),
    registration_office: String(formData.get('registration_office') || ''),
    sro_name: String(formData.get('sro_name') || ''),
    sro_code: String(formData.get('sro_code') || ''),
    plot_gps_coordinate: String(formData.get('plot_gps_coordinate') || ''),
    near_by_landmark: String(formData.get('near_by_landmark') || ''),
    gps_corners: {
      ne: corner(formData, 'ne'),
      se: corner(formData, 'se'),
      nw: corner(formData, 'nw'),
      sw: corner(formData, 'sw'),
    },
  };
}

// Step 1, create: "Plot Registration" — name, type, size, shape,
// description, address block, GPS corners.
export async function createProperty(formData: FormData) {
  const validationError = validateStep1(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('properties')
    .insert({ owner_id: userData.user.id, ...step1Payload(formData) })
    .select('id')
    .single();

  if (error) return { error: error.message };

  redirect(`/properties/${data.id}/ownership`);
}

// Step 1, edit: same fields, but updating an existing property instead of
// inserting a new one. Blocked once a property is verified unless the
// person editing is an admin (RLS enforces this too — this check just
// gives a clean error message instead of a raw Postgres failure).
export async function updateProperty(propertyId: string, formData: FormData, redirectTo?: string) {
  const validationError = validateStep1(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('properties')
    .select('status, owner_id')
    .eq('id', propertyId)
    .single();
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .single();

  if (existing?.status === 'verified' && !profile?.is_admin) {
    return { error: 'This property is verified and can only be edited by an admin.' };
  }

  const { error } = await supabase.from('properties').update(step1Payload(formData)).eq('id', propertyId);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/admin/${propertyId}`);
  redirect(redirectTo || `/properties/${propertyId}/ownership`);
}

const REQUIRED_OWNERSHIP_FIELDS: Array<[string, string]> = [
  ['owner_full_name', 'Owner Name'],
  ['is_owner', 'Is this plot owned by you?'],
];

// "Proofs of Ownership" screen: owner name, is-registered-user-owner,
// agent-entry consent, plus NOC/approval-letter/owner-ID uploads when the
// plot owner differs from the logged-in user. Every visible field on this
// screen is mandatory regardless of which branch (yes/no) is showing.
export async function saveOwnership(propertyId: string, formData: FormData, redirectTo?: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  for (const [field, label] of REQUIRED_OWNERSHIP_FIELDS) {
    if (!String(formData.get(field) || '').trim()) return { error: `${label} is required.` };
  }

  const isOwner = formData.get('is_owner') === 'yes';

  if (isOwner) {
    if (!String(formData.get('agent_entry_allowed') || '').trim()) {
      return { error: 'Please answer whether you allow our agent to enter this property.' };
    }
    if (formData.get('agent_entry_allowed') === 'no') {
      return {
        error:
          "Without agent access to visit and photograph the property, we can't verify its security or condition. Please allow agent entry to continue, or contact support for other options.",
      };
    }
  }

  const { data: existingOwnershipDocs } = await supabase
    .from('property_documents')
    .select('doc_type')
    .eq('property_id', propertyId)
    .in('doc_type', ['approval_letter', 'noc', 'owner_id']);
  const existingDocTypes = new Set((existingOwnershipDocs ?? []).map((d) => d.doc_type));

  const approvalFile = formData.get('approval_letter') as File | null;
  const nocFile = formData.get('noc_file') as File | null;
  const ownerIdFile = formData.get('owner_id_proof') as File | null;

  if (!existingDocTypes.has('approval_letter') && (!approvalFile || approvalFile.size === 0)) {
    return { error: 'Approval letter is required.' };
  }
  if (!existingDocTypes.has('noc') && (!nocFile || nocFile.size === 0)) {
    return { error: 'NOC letter is required.' };
  }
  if (!existingDocTypes.has('owner_id') && (!ownerIdFile || ownerIdFile.size === 0)) {
    return { error: 'Owner ID proof is required.' };
  }

  async function uploadIfPresent(field: string, docType: DocumentType) {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) return null;

    const { data: existing } = await supabase
      .from('property_documents')
      .select('id, file_path')
      .eq('property_id', propertyId)
      .eq('doc_type', docType)
      .maybeSingle();

    const path = `${propertyId}/${docType}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(path, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    // Explicit update-or-insert instead of .upsert()/ON CONFLICT — the
    // property_documents unique index is partial (to allow multiple
    // title_deed rows), and Postgres can't match ON CONFLICT against a
    // partial index unless the exact predicate is included in the
    // conflict clause, which the Supabase JS client has no way to pass.
    const docError = existing
      ? (await supabase.from('property_documents').update({ file_path: path }).eq('id', existing.id)).error
      : (await supabase.from('property_documents').insert({ property_id: propertyId, doc_type: docType, file_path: path })).error;
    if (docError) throw new Error(`Saving ${docType.replace(/_/g, ' ')} record failed: ${docError.message}`);

    // Replacing a file with a different name leaves the old one orphaned —
    // clean it up now that the new one is safely saved.
    if (existing?.file_path && existing.file_path !== path) {
      await supabase.storage.from('property-documents').remove([existing.file_path]);
    }

    return path;
  }

  try {
    const nocPath = await uploadIfPresent('noc_file', 'noc');
    const approvalPath = await uploadIfPresent('approval_letter', 'approval_letter');
    const ownerIdPath = await uploadIfPresent('owner_id_proof', 'owner_id');

    const { error } = await supabase.from('property_ownership').upsert(
      {
        property_id: propertyId,
        owner_full_name: String(formData.get('owner_full_name') || ''),
        is_registered_user_owner: isOwner,
        agent_entry_allowed: formData.get('agent_entry_allowed') === 'yes',
        ...(nocPath ? { noc_file_url: nocPath } : {}),
        ...(approvalPath ? { approval_letter_url: approvalPath } : {}),
        ...(ownerIdPath ? { owner_id_proof_url: ownerIdPath } : {}),
      },
      { onConflict: 'property_id' } // fixes: duplicate key value violates unique constraint "property_ownership_property_id_key"
    );
    if (error) return { error: error.message };
  } catch (e: any) {
    return { error: e.message };
  }

  redirect(redirectTo || `/properties/${propertyId}/documents`);
}

// Final "Property Title / Sale Deed / Encumbrance Certificate" screen +
// legal declarations + Submit / Reset / Cancel. Title deed and
// encumbrance certificate are mandatory on first submission; if they were
// already uploaded in an earlier visit (edit flow), re-uploading is optional.
export async function saveDocumentsAndSubmit(propertyId: string, formData: FormData, redirectTo?: string) {
  const supabase = await createClient();

  const { data: existingDocs } = await supabase
    .from('property_documents')
    .select('doc_type')
    .eq('property_id', propertyId)
    .eq('doc_type', 'title_deed');
  const existingTypes = new Set((existingDocs ?? []).map((d) => d.doc_type));

  const titleDeedFiles = (formData.getAll('title_deed') as File[]).filter((f) => f.size > 0);
  if (!existingTypes.has('title_deed') && titleDeedFiles.length === 0) {
    return { error: 'Property Title / Sale Deed is required.' };
  }

  const wantsDigitalEc = String(formData.get('ec_digital_copy_requested') || '');
  if (wantsDigitalEc !== 'yes' && wantsDigitalEc !== 'no') {
    return { error: 'Please answer whether you want a Digital Signed Certified copy of the EC.' };
  }
  if (wantsDigitalEc === 'yes') {
    if (!String(formData.get('ec_document_number') || '').trim()) return { error: 'Document Number is required.' };
    if (!String(formData.get('ec_registration_year') || '').trim()) return { error: 'Year of Registration is required.' };
    if (!String(formData.get('ec_registered_sro') || '').trim()) return { error: 'Registered at SRO is required.' };
  }

  async function uploadIfPresent(field: string, docType: DocumentType) {
    const file = formData.get(field) as File | null;
    if (!file || file.size === 0) return;

    const { data: existing } = await supabase
      .from('property_documents')
      .select('id, file_path')
      .eq('property_id', propertyId)
      .eq('doc_type', docType)
      .maybeSingle();

    const path = `${propertyId}/${docType}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('property-documents')
      .upload(path, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const docError = existing
      ? (await supabase.from('property_documents').update({ file_path: path }).eq('id', existing.id)).error
      : (await supabase.from('property_documents').insert({ property_id: propertyId, doc_type: docType, file_path: path })).error;
    if (docError) throw new Error(`Saving ${docType.replace(/_/g, ' ')} record failed: ${docError.message}`);

    if (existing?.file_path && existing.file_path !== path) {
      await supabase.storage.from('property-documents').remove([existing.file_path]);
    }
  }

  // Title deed allows multiple pages/files (e.g. first page + last page).
  // Each upload ADDS a new row rather than replacing the previous one —
  // unlike the other document types above, which stay single-file.
  async function uploadTitleDeedFiles(files: File[]) {
    for (const file of files) {
      const path = `${propertyId}/title_deed-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('property-documents').upload(path, file);
      if (uploadError) throw new Error(uploadError.message);
      const { error: docError } = await supabase
        .from('property_documents')
        .insert({ property_id: propertyId, doc_type: 'title_deed', file_path: path });
      if (docError) throw new Error(`Saving title deed record failed: ${docError.message}`);
    }
  }

  try {
    await uploadTitleDeedFiles(titleDeedFiles);
    await uploadIfPresent('ec_reference_copy', 'ec_reference_copy');
  } catch (e: any) {
    return { error: e.message };
  }

  const noLegalCase = formData.get('no_legal_case') === 'on';
  const agentTerms = formData.get('agent_entry_terms') === 'on';
  if (!noLegalCase || !agentTerms) {
    return { error: 'Please confirm both declarations before submitting.' };
  }

  const { error: ownershipError } = await supabase
    .from('property_ownership')
    .update({
      no_legal_case_declared: noLegalCase,
      agent_entry_terms_agreed: agentTerms,
      other_terms_conditions: String(formData.get('other_terms') || ''),
      ec_digital_copy_requested: wantsDigitalEc === 'yes',
      ec_document_number: wantsDigitalEc === 'yes' ? String(formData.get('ec_document_number') || '') : null,
      ec_registration_year: wantsDigitalEc === 'yes' ? String(formData.get('ec_registration_year') || '') : null,
      ec_registered_sro: wantsDigitalEc === 'yes' ? String(formData.get('ec_registered_sro') || '') : null,
    })
    .eq('property_id', propertyId);
  if (ownershipError) return { error: ownershipError.message };

  // Registration is (re)submitted. If this property was previously rejected,
  // resubmitting sends it back into the verification queue rather than
  // leaving it stuck as "rejected" forever.
  const { data: currentProperty } = await supabase
    .from('properties')
    .select('status')
    .eq('id', propertyId)
    .single();

  const patch: Record<string, unknown> = { registration_date: new Date().toISOString().slice(0, 10) };
  if (currentProperty?.status === 'rejected') {
    patch.status = 'pending';
  }

  const { error } = await supabase.from('properties').update(patch).eq('id', propertyId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  revalidatePath('/dashboard');
  redirect(redirectTo || `/properties/${propertyId}`);
}

// Lets the owner (or admin) view a document they already uploaded, via a
// short-lived signed URL — the bucket is private, so this is the only way
// to open an existing file without re-uploading it.
export async function getDocumentViewUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('property-documents').createSignedUrl(filePath, 60 * 5);
  if (error) return null;
  return data.signedUrl;
}

// Used by the edit route + the Back-navigation prefill on steps 2 and 3.
export async function getPropertyForEdit(propertyId: string) {
  const supabase = await createClient();
  const [{ data: property }, { data: ownership }, { data: documents }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    supabase.from('property_ownership').select('*').eq('property_id', propertyId).maybeSingle(),
    supabase.from('property_documents').select('doc_type, file_path').eq('property_id', propertyId),
  ]);
  return { property, ownership, documents: documents ?? [] };
}

// Central permission check reused by the edit page and the ownership/
// documents steps: an owner can edit their own property up until it's
// verified; an admin can always edit.
export async function canEditProperty(propertyId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const [{ data: property }, { data: profile }] = await Promise.all([
    supabase.from('properties').select('status, owner_id').eq('id', propertyId).single(),
    supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single(),
  ]);
  if (!property) return false;
  if (profile?.is_admin) return true;
  if (property.owner_id !== userData.user.id) return false;
  return property.status !== 'verified';
}
