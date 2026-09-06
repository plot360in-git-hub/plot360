import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { MonitoringOverview } from '@/components/admin/MonitoringOverview';

export default async function AdminMonitoringPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <MonitoringOverview />;
}
