'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';

export async function getPendingAgents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_profiles')
    .select('*, profiles(username, first_name, last_name, email, phone_country_code, phone_number)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getAgentForReview(agentId: string) {
  const supabase = await createClient();
  const [{ data: agentProfile }, { data: documents }] = await Promise.all([
    supabase
      .from('agent_profiles')
      .select('*, profiles(*)')
      .eq('id', agentId)
      .single(),
    supabase.from('agent_documents').select('*').eq('agent_id', agentId).order('uploaded_at', { ascending: true }),
  ]);
  return { agentProfile, documents: documents ?? [] };
}

export async function getAgentDocumentUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('agent-documents').createSignedUrl(filePath, 60 * 5);
  if (error) return null;
  return data.signedUrl;
}

export async function setAgentStatus(agentId: string, status: 'verified' | 'rejected', notes?: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('agent_profiles')
    .update({ status, admin_notes: notes || null })
    .eq('id', agentId);
  if (error) return { error: error.message };

  revalidatePath('/admin/agents');
  return { success: true };
}

export async function getVerifiedAgents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, profiles(first_name, last_name, email)')
    .eq('status', 'verified');
  return data ?? [];
}

// Redesign 2026-09 — admin console, Agent verification detail screen's
// "Request missing documents": sends the agent a WhatsApp and logs it,
// but — unlike setAgentStatus('rejected') — does NOT change
// agent_profiles.status, since the agent isn't being turned away, just
// asked for one more thing while their application stays pending.
//
// Redesign 2026-09 (follow-up) — this used to only log the message to
// the whatsapp_messages outbox and stop there. Nothing ever opened
// WhatsApp, so the admin clicking "Send request" did nothing visible and
// the agent was never actually messaged. Now returns the same
// phoneCountryCode/phoneNumber/message shape sendAdditionalInfoRequest
// (review-decisions.actions.ts) does, so RejectionDialog can open the
// real wa.me link right after logging it — same click-to-open pattern as
// SendInfoRequestButton/ResendWhatsAppButton.
export async function requestAgentDocuments(agentId: string, reasonText: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('profiles(phone_country_code, phone_number)')
    .eq('id', agentId)
    .single();
  const profile: any = agentProfile?.profiles;
  const phoneCountryCode = profile?.phone_country_code ?? '';
  const phoneNumber = profile?.phone_number ?? '';
  if (!phoneNumber) return { error: 'No phone number on file for this agent.' };

  const { logWhatsAppMessage } = await import('./whatsapp-log.actions');
  const { logAdminAction } = await import('./timeline.actions');

  const body = `Plot360: Before we can verify your agent account, we need one more thing. ${reasonText.trim()} Reply here with a photo and we will add it for you.`;
  await logWhatsAppMessage({ relatedEntityType: 'agent_profile', relatedEntityId: agentId, recipientPhone: `${phoneCountryCode}${phoneNumber}`, body });
  await logAdminAction({ entityType: 'agent_profile', entityId: agentId, action: 'Requested missing documents', note: reasonText.trim() });

  revalidatePath(`/admin/agents/${agentId}`);
  return { success: true as const, phoneCountryCode, phoneNumber, message: body };
}

// Redesign 2026-09 (follow-up) — Agent verification detail screen's
// Mobile number / Email / SRO name / SRO number were readOnly; Plot
// asked for them to be editable by admin/reviewer (agents sometimes
// mistype these at signup, and a reviewer catches it here). Note: the
// "Email" field here only updates the profiles row (what the team sees
// and what WhatsApp/notifications use) — it does not change the agent's
// Supabase Auth login credential, which needs the service-role admin API
// and its own confirmation step; out of scope for a quick correction.
export async function updateAgentVerificationFields(
  agentId: string,
  fields: { phoneCountryCode: string; phoneNumber: string; email: string; sroName: string; sroCode: string }
) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      phone_country_code: fields.phoneCountryCode.trim() || null,
      phone_number: fields.phoneNumber.trim() || null,
      email: fields.email.trim(),
    })
    .eq('id', agentId);
  if (profileError) return { error: profileError.message };

  const { error: agentError } = await supabase
    .from('agent_profiles')
    .update({ sro_name: fields.sroName.trim() || null, sro_code: fields.sroCode.trim() || null })
    .eq('id', agentId);
  if (agentError) return { error: agentError.message };

  revalidatePath(`/admin/agents/${agentId}`);
  return { success: true as const };
}

// Redesign 2026-09 (follow-up) — multi-file support for admin/reviewer:
// they can now attach an extra photo of a document straight from the
// verification screen (e.g. an agent sent the back of their licence over
// WhatsApp and the admin is adding it on the agent's behalf), and remove
// a bad one. Uses the admin's own session — agent_documents_admin_all /
// the matching storage policy (supabase/schema.sql) grant is_admin() full
// access, so no service-role client is needed here.
export async function uploadAgentDocumentAsAdmin(agentId: string, docType: 'driving_license' | 'secondary_id', formData: FormData) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Choose a file first.' };

  const supabase = await createClient();
  const path = `${agentId}/${docType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('agent-documents')
    .upload(path, fileBuffer, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) return { error: uploadError.message };

  const { error: docError } = await supabase.from('agent_documents').insert({ agent_id: agentId, doc_type: docType, file_path: path });
  if (docError) return { error: docError.message };

  revalidatePath(`/admin/agents/${agentId}`);
  return { success: true as const };
}

export async function deleteAgentDocumentAsAdmin(documentId: string, agentId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();

  const { data: doc } = await supabase.from('agent_documents').select('file_path').eq('id', documentId).single();
  if (!doc) return { error: 'Document not found.' };

  await supabase.storage.from('agent-documents').remove([doc.file_path]);
  const { error } = await supabase.from('agent_documents').delete().eq('id', documentId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/agents/${agentId}`);
  return { success: true as const };
}
