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
    supabase.from('agent_documents').select('*').eq('agent_id', agentId),
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
