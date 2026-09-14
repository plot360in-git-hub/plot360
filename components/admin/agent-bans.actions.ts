'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isCurrentUserAdmin } from './admin.actions';
import { logAdminAction } from './timeline.actions';

// Redesign 2026-09 — admin console. Agent banning had ZERO implementation
// before this phase (see ARCHITECTURE.md) — agent_profiles.status only
// ever took pending/verified/rejected, and nothing blocked a banned
// agent from signing in. This wires the `bans` table (already in
// schema.sql, unused) into real enforcement: components/agent/
// agent-auth.actions.ts checks it on every login and gate check, and
// getVerifiedAgentsExcludingBanned() below is what the assignment
// screen and suggested-agent ranking use so a banned agent never gets
// offered new work. The agent-detail Disable/Enable toggle and the
// Users → Field agents row both call toggleAgentBan, so there is only
// ever one flag to disagree about, per the README's "one source of
// truth" rule.
export async function getBannedAgentIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from('bans').select('subject_id').eq('subject_type', 'agent').eq('active', true);
  return new Set((data ?? []).map((r) => r.subject_id as string));
}

export async function isAgentBanned(agentId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('bans')
    .select('id')
    .eq('subject_type', 'agent')
    .eq('subject_id', agentId)
    .eq('active', true)
    .maybeSingle();
  return !!data;
}

export async function toggleAgentBan(agentId: string, shouldBan: boolean, reason?: string) {
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from('bans')
    .select('id')
    .eq('subject_type', 'agent')
    .eq('subject_id', agentId)
    .maybeSingle();

  const payload = {
    subject_type: 'agent' as const,
    subject_id: agentId,
    active: shouldBan,
    reason: shouldBan ? reason?.trim() || null : null,
    actor: userData.user?.id ?? null,
  };

  const { error } = existing
    ? await supabase.from('bans').update(payload).eq('id', existing.id)
    : await supabase.from('bans').insert(payload);
  if (error) return { error: error.message };

  await logAdminAction({
    entityType: 'agent_profile',
    entityId: agentId,
    action: shouldBan ? 'Login disabled' : 'Login enabled',
    note: shouldBan ? reason?.trim() || undefined : undefined,
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/agents/${agentId}`);
  revalidatePath('/admin/queue/agent-verification');
  return { success: true };
}

// Same shape as monitoring.actions.ts's getVerifiedAgentsList(), minus
// anyone currently banned — used by the redesigned Assignment screen.
export async function getVerifiedAgentsExcludingBanned() {
  const supabase = await createClient();
  const [{ data: agents }, banned] = await Promise.all([
    supabase.from('agent_profiles').select('id, sro_name, sro_code, profiles(first_name, last_name, email)').eq('status', 'verified'),
    getBannedAgentIds(),
  ]);
  return (agents ?? []).filter((a) => !banned.has(a.id));
}

// Users screen, "Field agents" tab — the ban flag here is the SAME
// `bans` row toggleAgentBan writes on the agent-detail page, so the two
// surfaces can never disagree (the README's "one source of truth" rule).
export async function getAgentsForUsersTab(query?: string) {
  const supabase = await createClient();
  const [{ data: agents }, banned] = await Promise.all([
    supabase.from('agent_profiles').select('id, sro_name, sro_code, created_at, profiles(first_name, last_name, email)'),
    getBannedAgentIds(),
  ]);
  const list = agents ?? [];
  if (list.length === 0) return [];

  const ids = list.map((a) => a.id);
  const { data: doneJobs } = await supabase.from('monitoring_jobs').select('agent_id').in('agent_id', ids).eq('status', 'approved');
  const doneCount: Record<string, number> = {};
  for (const j of doneJobs ?? []) doneCount[j.agent_id] = (doneCount[j.agent_id] ?? 0) + 1;

  const q = (query ?? '').trim().toLowerCase();
  return list
    .map((a: any) => ({ ...a, visitsDone: doneCount[a.id] ?? 0, isBanned: banned.has(a.id) }))
    .filter((a: any) => {
      if (!q) return true;
      const name = `${a.profiles?.first_name ?? ''} ${a.profiles?.last_name ?? ''} ${a.sro_name ?? ''} ${a.sro_code ?? ''}`.toLowerCase();
      return name.includes(q);
    });
}
