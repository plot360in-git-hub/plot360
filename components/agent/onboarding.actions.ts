'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Redesign 2026-09 (follow-up, round 22) — this used to be the single,
// mandatory "Agent Registration" step (full home address, SRO, both ID
// documents all required before an agent could exist at all). Now that
// agentSignUpAndRegister (agent-auth.actions.ts) creates the account,
// name, mobile and optional documents together at signup for the
// email/password path, this form/action only runs for a first-time OAuth
// agent finishing that same minimal signup (no session exists yet at
// signup time for OAuth to attach form fields to) — so it keeps only
// what OAuth doesn't already collect: name, mobile, optional documents.
// SRO moved to the Profile & SRO screen (updateAgentContactInfo, below)
// and home address is no longer collected anywhere in the agent flow —
// neither the new signup mock nor admin's own review screen
// (AgentVerificationDetail.tsx) ever showed it.
export async function completeAgentRegistration(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const phoneNumber = String(formData.get('phone_number') || '').trim();
  const email = String(formData.get('email') || '').trim();

  if (!firstName || !lastName) return { error: 'First and last name are required.' };
  if (!phoneNumber) return { error: 'Phone number is required.' };
  if (!email) return { error: 'Email is required.' };

  const profilePatch: Record<string, unknown> = {
    id: userData.user.id,
    email,
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    phone_country_code: String(formData.get('phone_country_code') || '') || '+91',
    is_agent: true,
  };

  const { error: profileError } = await supabase.from('profiles').upsert(profilePatch);
  if (profileError) return { error: profileError.message };

  // Create the agent_profiles row BEFORE uploading documents —
  // agent_documents.agent_id has a foreign key to agent_profiles(id), so on
  // a first-time registration that row must exist first or the document
  // inserts below fail with a foreign key violation. SRO is deliberately
  // not touched here — it's not collected on this screen, and upsert only
  // ever writes the columns given, so an existing sro_name/sro_code (set
  // later via the Profile & SRO screen) is left exactly as it was.
  const { error: agentError } = await supabase.from('agent_profiles').upsert({
    id: userData.user.id,
    status: 'pending',
    admin_notes: null,
  });
  if (agentError) return { error: agentError.message };

  // Redesign 2026-09 (follow-up) — Plot: "multi files should be allowed
  // for Agent ... front side as well as back side." formData.getAll picks
  // up every file the <input multiple> selected; each becomes its own
  // agent_documents row (INSERT, not upsert — the old one-file-per-type
  // unique constraint is gone, see supabase/schema.sql), so uploading a
  // second file no longer silently replaces the first.
  async function uploadDocs(field: string, docType: 'driving_license' | 'secondary_id') {
    const files = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      const path = `${userData.user!.id}/${docType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(path, fileBuffer, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message);

      const { error: docError } = await supabase.from('agent_documents').insert({ agent_id: userData.user!.id, doc_type: docType, file_path: path });
      if (docError) throw new Error(docError.message);
    }
  }

  // Redesign 2026-09 (follow-up, round 22) — documents are optional at
  // this stage now ("needed before your first job", not before the
  // account can exist) — uploadDocs itself is already a no-op when a
  // field is empty, so there's nothing to require here.
  try {
    await uploadDocs('driving_license', 'driving_license');
    await uploadDocs('secondary_id', 'secondary_id');
  } catch (e: any) {
    return { error: e.message };
  }

  redirect('/agent/dashboard');
}

// For an already-verified agent: lets them update only phone/email/address/
// photo (not name or ID documents). Submitting sends them back for
// reverification — the same "resubmission" pattern as a rejection, just
// triggered by the agent themself rather than an admin decision.
// Redesign 2026-09 (follow-up, round 22) — "Profile & SRO" (design_handoff_
// plot360_redesign, "Plot360 Field Agent" mocks): where you work
// (SRO name/number) plus document Replace/Attach now live here instead of
// only at registration. Home address and profile photo are no longer part
// of the agent flow — the new mocks never show either, and dropped the
// same way from completeAgentRegistration above.
export async function updateAgentContactInfo(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const phoneNumber = String(formData.get('phone_number') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const sroName = String(formData.get('sro_name') || '').trim();
  const sroCode = String(formData.get('sro_code') || '').trim();

  if (!phoneNumber) return { error: 'Phone number is required.' };
  if (!email) return { error: 'Email is required.' };
  if (!sroName || !sroCode) return { error: 'SRO Name and SRO Code are required.' };

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
    phone_country_code: String(formData.get('phone_country_code') || '') || '+91',
  };

  const { error: profileError } = await supabase.from('profiles').update(patch).eq('id', userData.user.id);
  if (profileError) return { error: profileError.message };

  const { error: agentError } = await supabase
    .from('agent_profiles')
    .update({ status: 'pending', admin_notes: null, sro_name: sroName, sro_code: sroCode })
    .eq('id', userData.user.id);
  if (agentError) return { error: agentError.message };

  // Documents: optional Attach-more right from this screen. Redesign
  // 2026-09 (follow-up) — Plot: "multi files should be allowed for Agent
  // ... at the time of registration as well" — this now ADDS files
  // (INSERT) rather than replacing whatever was already on file for that
  // doc_type, same as completeAgentRegistration above. Use
  // deleteAgentDocument (below) to remove a bad one instead.
  async function uploadDocs(field: string, docType: 'driving_license' | 'secondary_id') {
    const files = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      const path = `${userData.user!.id}/${docType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const fileBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(path, fileBuffer, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message);

      const { error: docError } = await supabase.from('agent_documents').insert({ agent_id: userData.user!.id, doc_type: docType, file_path: path });
      if (docError) throw new Error(docError.message);
    }
  }

  try {
    await uploadDocs('driving_license', 'driving_license');
    await uploadDocs('secondary_id', 'secondary_id');
  } catch (e: any) {
    return { error: e.message };
  }

  return { success: true, emailChangeRequested };
}

// Redesign 2026-09 (follow-up) — lets an agent remove one of their own
// files (e.g. a blurry retake) now that multiple files per doc_type are
// allowed. agent_documents_delete_own (supabase/schema.sql) restricts
// this to the agent's own rows.
export async function deleteAgentDocument(documentId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: doc } = await supabase.from('agent_documents').select('file_path, agent_id').eq('id', documentId).single();
  if (!doc || doc.agent_id !== userData.user.id) return { error: 'Document not found.' };

  await supabase.storage.from('agent-documents').remove([doc.file_path]);
  const { error } = await supabase.from('agent_documents').delete().eq('id', documentId);
  if (error) return { error: error.message };

  return { success: true as const };
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
    supabase.from('agent_documents').select('id, doc_type, file_path, uploaded_at').eq('agent_id', userData.user.id).order('uploaded_at', { ascending: true }),
  ]);

  return { profile, agentProfile, documents: documents ?? [] };
}
