'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const, error: 'Only an admin can do this.' };
  return { ok: true as const };
}

// Combines Supabase Auth's user list (email, confirmation status, ban
// status — none of which live in our own tables) with our profiles table
// (name, role flags). Requires the admin client since listing/banning
// users is an Auth Admin API operation, not something RLS can expose.
export async function getAllUsers() {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error, users: [] };

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: authData, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { error: error.message, users: [] };

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, username, email, is_admin, is_agent');
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const users = authData.users.map((u) => {
    const profile = profileById.get(u.id);
    const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
    return {
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      emailConfirmed: !!u.email_confirmed_at,
      isBanned,
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      isAdmin: profile?.is_admin ?? false,
      isAgent: profile?.is_agent ?? false,
    };
  });

  return { users, error: null };
}

// Bans (disables login) or unbans a user via the Auth Admin API. Supabase
// doesn't have a simple boolean "disabled" flag — banning for a very long
// duration is the standard way to achieve "disabled until manually
// re-enabled"; 'none' clears it.
export async function toggleUserBan(userId: string, shouldBan: boolean) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: shouldBan ? '876000h' : 'none',
  });
  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  return { success: true };
}
