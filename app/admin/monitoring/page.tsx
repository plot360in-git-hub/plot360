import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { MonitoringOverview } from '@/components/admin/MonitoringOverview';

// Redesign 2026-09 (follow-up, 2026-09-26) — now takes a `q` search param
// (see MonitoringSearchBox.tsx) so an admin can find any customer or
// property's visit progress regardless of which status it's currently in
// — see MonitoringOverview.tsx for why that mattered.
export default async function AdminMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const sp = await searchParams;
  return <MonitoringOverview query={sp.q ?? ''} />;
}
