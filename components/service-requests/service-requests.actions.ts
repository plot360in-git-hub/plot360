'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function getSenderRole(supabase: any, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return profile?.is_admin ? 'admin' : 'customer';
}

export async function createServiceRequest(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const subject = String(formData.get('subject') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const propertyId = String(formData.get('property_id') || '') || null;
  if (!subject) return { error: 'Subject is required.' };
  if (!description) return { error: 'Please describe your issue or request.' };

  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .insert({ customer_id: userData.user.id, property_id: propertyId, subject })
    .select('id')
    .single();
  if (requestError) return { error: requestError.message };

  const { data: message, error: messageError } = await supabase
    .from('service_request_messages')
    .insert({ request_id: request.id, sender_id: userData.user.id, sender_role: 'customer', message: description })
    .select('id')
    .single();
  if (messageError) return { error: messageError.message };

  const files = (formData.getAll('attachments') as File[]).filter((f) => f.size > 0);
  for (const file of files) {
    const path = `${request.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('service-request-files').upload(path, file);
    if (uploadError) return { error: uploadError.message };
    await supabase.from('service_request_attachments').insert({ message_id: message.id, file_path: path });
  }

  return { success: true, requestId: request.id };
}

export async function getMyServiceRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_requests')
    .select('id, subject, status, created_at, updated_at, properties(property_name)')
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getAllServiceRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('service_requests')
    .select('id, subject, status, created_at, updated_at, properties(property_name), profiles(first_name, last_name, email)')
    .order('updated_at', { ascending: false });
  return data ?? [];
}

export async function getServiceRequestDetail(requestId: string) {
  const supabase = await createClient();
  const [{ data: request }, { data: messages }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('*, properties(property_name), profiles(first_name, last_name, email)')
      .eq('id', requestId)
      .single(),
    supabase
      .from('service_request_messages')
      .select('*, service_request_attachments(id, file_path)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true }),
  ]);
  return { request, messages: messages ?? [] };
}

export async function postServiceRequestMessage(requestId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: request } = await supabase.from('service_requests').select('status').eq('id', requestId).single();
  if (!request) return { error: 'Request not found.' };
  if (request.status === 'closed') return { error: "This request is closed — please submit a new request." };

  const text = String(formData.get('message') || '').trim();
  if (!text) return { error: 'Please write a message.' };

  const senderRole = await getSenderRole(supabase, userData.user.id);

  const { data: message, error: messageError } = await supabase
    .from('service_request_messages')
    .insert({ request_id: requestId, sender_id: userData.user.id, sender_role: senderRole, message: text })
    .select('id')
    .single();
  if (messageError) return { error: messageError.message };

  const files = (formData.getAll('attachments') as File[]).filter((f) => f.size > 0);
  for (const file of files) {
    const path = `${requestId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('service-request-files').upload(path, file);
    if (uploadError) return { error: uploadError.message };
    await supabase.from('service_request_attachments').insert({ message_id: message.id, file_path: path });
  }

  await supabase.from('service_requests').update({ updated_at: new Date().toISOString() }).eq('id', requestId);

  revalidatePath(`/service-requests/${requestId}`);
  revalidatePath(`/admin/service-requests/${requestId}`);
  return { success: true };
}

export async function closeServiceRequest(requestId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const closedBy = await getSenderRole(supabase, userData.user.id);

  const { error } = await supabase
    .from('service_requests')
    .update({ status: 'closed', closed_by: closedBy, closed_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) return { error: error.message };

  revalidatePath(`/service-requests/${requestId}`);
  revalidatePath(`/admin/service-requests/${requestId}`);
  revalidatePath('/service-requests');
  revalidatePath('/admin/service-requests');
  return { success: true };
}

export async function getServiceRequestFileUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from('service-request-files').createSignedUrl(filePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export async function getMyPropertiesForServiceRequest() {
  const supabase = await createClient();
  const { data } = await supabase.from('properties').select('id, property_name').order('property_name');
  return data ?? [];
}
