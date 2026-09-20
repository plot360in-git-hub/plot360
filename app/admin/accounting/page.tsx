import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getCurrentAdminContext } from '@/components/admin/admin-role.actions';
import { AccountingPage } from '@/components/admin/AccountingPage';

// Redesign 2026-09 (round 32) — new Accounting screen, owner role only.
// Same gating pattern as app/admin/plans/page.tsx and app/admin/users/page.tsx.
export default async function AdminAccountingPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const ctx = await getCurrentAdminContext();
  if (!ctx.ok || ctx.role !== 'owner') redirect('/admin');

  return <AccountingPage />;
}
