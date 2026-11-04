import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getCurrentAdminContext } from '@/components/admin/admin-role.actions';
import { CustomerDetail } from '@/components/admin/CustomerDetail';

// Redesign 2026-09 (follow-up, 2026-11-04) — Plot: "a place to check a
// user and his registered property list". Owner-only, same gate as
// app/admin/users/page.tsx (this is reached from that screen and reads
// the same Auth Admin API data getAllUsers does).
export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const ctx = await getCurrentAdminContext();
  if (!ctx.ok || ctx.role !== 'owner') redirect('/admin');

  const { id } = await params;
  return <CustomerDetail userId={id} />;
}
