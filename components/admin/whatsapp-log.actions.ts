'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';

// Redesign 2026-09 — admin console. whatsapp_messages was added to
// schema.sql in the foundation phase but nothing wrote to it — every
// "send" was just a client-side wa.me link (see components/admin/
// whatsapp.ts, kept as-is: it still builds the link text). This file
// is the persistence layer the design's dashboard ("Failed WhatsApp
// messages") and per-screen "WhatsApp outbox" panels read from.
//
// There's no real WhatsApp Business API wired up (the design handoff's
// own "placeholders to replace" note) — delivery status can't be
// detected automatically. So, matching the schema's own comment
// ("'sent' logged the moment link is opened; 'failed' set only when
// admin explicitly marks a message as not gone through"): every logged
// message starts 'sent' the moment an admin opens the wa.me link, and
// only becomes 'failed' if an admin explicitly flags it (e.g. a
// customer says on a service request that they never got it). This is
// a known limitation, not a bug — disclosed in ARCHITECTURE.md.
export type WhatsAppEntityType = 'monitoring_job' | 'property' | 'agent_profile' | 'payment' | 'service_request' | 'enquiry';

export async function logWhatsAppMessage(input: {
  relatedEntityType: WhatsAppEntityType;
  relatedEntityId: string;
  recipientPhone: string;
  body: string;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({
      related_entity_type: input.relatedEntityType,
      related_entity_id: input.relatedEntityId,
      recipient_phone: input.recipientPhone,
      body: input.body,
      state: 'sent',
      sent_by: userData.user?.id ?? null,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { success: true, id: data.id as string };
}

export async function getOutboxForEntity(entityType: WhatsAppEntityType, entityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('related_entity_type', entityType)
    .eq('related_entity_id', entityId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function markWhatsAppMessageFailed(messageId: string, reason: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ state: 'failed', failure_reason: reason.trim() || 'Marked as not delivered.' })
    .eq('id', messageId);
  if (error) return { error: error.message };
  revalidatePath('/admin');
  return { success: true };
}

// Re-opens the same message: stamps resent_at and flips the state back
// to 'sent' (the admin is about to click the wa.me link again).
export async function resendWhatsAppMessage(messageId: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const { data: row } = await supabase.from('whatsapp_messages').select('*').eq('id', messageId).single();
  if (!row) return { error: 'Message not found.' };

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ state: 'sent', resent_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { success: true, recipientPhone: row.recipient_phone as string, body: row.body as string };
}

// Dashboard's "Failed WhatsApp messages" list.
export async function getFailedWhatsAppMessages(limit = 20) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('state', 'failed')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}
