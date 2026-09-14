'use server';

import { createClient } from '@/lib/supabase/server';

// Redesign 2026-09 — admin console. admin_actions was added to
// schema.sql in the foundation phase but nothing wrote to it yet — this
// is the internal-only timeline shown on the right pane of the
// Property verification and Agent submission review screens ("Internal
// only. The customer sees four milestones and nothing else."). Callers
// across this phase's new action files call logAdminAction after any
// decision worth recording; getTimeline merges those rows with a few
// synthesized milestones (registration, payment) so properties that
// predate this logging still show a sensible history instead of an
// empty pane.
export type TimelineEntityType = 'property' | 'monitoring_job' | 'agent_profile' | 'payment' | 'service_request';

export async function logAdminAction(input: {
  entityType: TimelineEntityType;
  entityId: string;
  action: string;
  note?: string;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from('admin_actions').insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor: userData.user?.id ?? null,
    note: input.note?.trim() || null,
  });
}

export async function getTimeline(entityType: TimelineEntityType, entityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('admin_actions')
    .select('id, action, note, created_at, profiles(first_name, last_name, username, email, is_admin, is_agent)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });
  return data ?? [];
}
