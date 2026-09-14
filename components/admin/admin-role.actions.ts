'use server';

import { createClient } from '@/lib/supabase/server';
import { profileDisplayName } from './displayName';

// Redesign 2026-09 — admin console. The design splits admins into
// "operations" (queues + assignment) and "owner" (also Plans & pricing
// and Users), gated SERVER-side per the README. Before this phase the
// app had no such distinction — every profiles.is_admin row saw every
// screen. See supabase/schema.sql "Redesign 2026-09 — admin console"
// for why every pre-existing admin was backfilled to 'owner' rather
// than defaulting to the more restrictive role.
export type AdminRole = 'operations' | 'owner';

export type AdminContext =
  | { ok: false; error: string }
  | { ok: true; userId: string; role: AdminRole; name: string };

export async function getCurrentAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: 'Not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, admin_role, first_name, last_name, username, email')
    .eq('id', userData.user.id)
    .single();
  if (!profile?.is_admin) return { ok: false, error: 'Only an admin can do this.' };

  return {
    ok: true,
    userId: userData.user.id,
    role: (profile.admin_role as AdminRole) ?? 'operations',
    name: profileDisplayName(profile),
  };
}

// For owner-only actions (Plans & pricing, Users). Mirrors the
// requireAdmin() pattern already used across components/admin and
// components/payments action files.
export async function requireOwnerAdmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const ctx = await getCurrentAdminContext();
  if (!ctx.ok) return ctx;
  if (ctx.role !== 'owner') return { ok: false, error: 'Only the owner role can do this.' };
  return { ok: true, userId: ctx.userId };
}
