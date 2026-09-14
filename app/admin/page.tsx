import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

// Redesign 2026-09 — swapped to the new "Waiting on you" dashboard.
// AdminQueue.tsx is kept intact but no longer wired here — see
// ARCHITECTURE.md.
export default async function AdminPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <AdminDashboard />;
}
