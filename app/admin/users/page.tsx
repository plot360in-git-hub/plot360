import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getCurrentAdminContext } from '@/components/admin/admin-role.actions';
import { UsersPage } from '@/components/admin/UsersPage';

// Redesign 2026-09 — swapped to the new Users screen, now gated
// server-side to the owner role (see app/admin/plans/page.tsx for the
// same pattern and rationale). AdminUsersList.tsx is kept intact but no
// longer wired here — see ARCHITECTURE.md.
export default async function AdminUsersPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const ctx = await getCurrentAdminContext();
  if (!ctx.ok || ctx.role !== 'owner') redirect('/admin');

  return <UsersPage />;
}
