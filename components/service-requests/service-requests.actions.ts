'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendNotificationEmail } from '@/lib/email';

async function getSenderRole(supabase: any, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return profile?.is_admin ? 'admin' : 'customer';
}

// Redesign 2026-09 (follow-up) — Plot: "Customer dashboard auto refresh
// is not working — showed 1 open request when there were really 2, and
// only a manual page refresh caught up." CustomerHeader.tsx (the open-
// request badge) is duplicated across six independent top-level layouts
// (dashboard, tasks, profile, properties, service-requests, onboarding —
// plus a few property sub-pages that render it directly), and
// createServiceRequest below had NO revalidatePath call at all — so
// every one of those cached layouts kept showing whatever count they'd
// last rendered until something else (or a hard reload) happened to
// revalidate them. 'layout' (not the default 'page') so a nested dynamic
// route under one of these — e.g. /properties/[id]/subscribe — is
// covered too, not just the top-level route itself.
function revalidateServiceRequestSurfaces() {
  for (const p of ['/dashboard', '/tasks', '/profile', '/properties', '/service-requests', '/onboarding']) {
    revalidatePath(p, 'layout');
  }
}

export async function getMyOpenServiceRequestCount() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;
  // Redesign 2026-09 (follow-up) — this was missing the customer_id
  // filter its name promises, so it silently counted every customer's
  // open requests platform-wide, not just the signed-in customer's own —
  // not the bug Plot reported (that was a stale-cache issue, fixed above
  // with revalidateServiceRequestSurfaces), but found nearby while
  // fixing it, and worth closing before this is used by more than one
  // real customer.
  const { count } = await supabase
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')
    .eq('customer_id', userData.user.id);
  return count ?? 0;
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

  // Redesign 2026-09 (follow-up) — attachments no longer uploaded here
  // (used to go straight through this Server Action, hitting Vercel's
  // hard 4.5MB function body limit — see ARCHITECTURE.md #60). The caller
  // uploads them directly to storage afterward via
  // createServiceRequestUploadUrls + recordServiceRequestAttachments,
  // using the requestId/messageId returned below.
  revalidateServiceRequestSurfaces();
  return { success: true, requestId: request.id, messageId: message.id };
}

// Redesign 2026-09 (follow-up) — signed-upload-url step for service
// request attachments; see lib/uploadDirect.ts and ARCHITECTURE.md #60.
export async function createServiceRequestUploadUrls(requestId: string, fileNames: string[]) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  if (fileNames.length === 0) return { error: 'No files selected.' };

  const { data: request } = await supabase.from('service_requests').select('customer_id').eq('id', requestId).single();
  if (!request) return { error: 'Request not found.' };
  const senderRole = await getSenderRole(supabase, userData.user.id);
  if (senderRole !== 'admin' && request.customer_id !== userData.user.id) return { error: 'Not authorized.' };

  const uploads: { fileName: string; path: string; token: string }[] = [];
  for (let i = 0; i < fileNames.length; i++) {
    const path = `${requestId}/${Date.now()}-${i}-${fileNames[i]}`;
    const { data, error } = await supabase.storage.from('service-request-files').createSignedUploadUrl(path);
    if (error) return { error: error.message };
    uploads.push({ fileName: fileNames[i], path, token: data.token });
  }
  return { success: true, bucket: 'service-request-files' as const, uploads };
}

export async function recordServiceRequestAttachments(messageId: string, paths: string[]) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  if (paths.length === 0) return { error: 'No files selected.' };

  for (const path of paths) {
    const { error } = await supabase.from('service_request_attachments').insert({ message_id: messageId, file_path: path });
    if (error) return { error: error.message };
  }
  return { success: true };
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

  const { data: request } = await supabase.from('service_requests').select('status, subject, customer_id').eq('id', requestId).single();
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

  // Redesign 2026-09 (follow-up) — attachments uploaded separately now,
  // straight to storage — see createServiceRequestUploadUrls /
  // recordServiceRequestAttachments above and ARCHITECTURE.md #60.

  await supabase.from('service_requests').update({ updated_at: new Date().toISOString() }).eq('id', requestId);

  // Only notify the customer when it's the ADMIN side replying — a
  // customer's own message doesn't need to notify themself.
  if (senderRole === 'admin') {
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('email, first_name')
      .eq('id', request.customer_id)
      .single();
    if (customerProfile?.email) {
      await sendNotificationEmail({
        to: customerProfile.email,
        subject: `New reply: ${request.subject}`,
        heading: 'You have a new reply',
        bodyLines: [
          `Hi ${customerProfile.first_name || 'there'},`,
          `Plot360 Support replied to your request "${request.subject}". Log in to view the full message and continue the conversation.`,
        ],
        ctaText: 'View request',
        ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://uat.plot360.in'}/service-requests/${requestId}`,
      });
    }
  }

  revalidatePath(`/service-requests/${requestId}`);
  revalidatePath(`/admin/service-requests/${requestId}`);
  return { success: true, messageId: message.id };
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
  revalidatePath('/admin/service-requests');
  revalidateServiceRequestSurfaces();
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
