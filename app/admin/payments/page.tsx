import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { PaymentsOverview } from '@/components/admin/PaymentsOverview';

export default async function AdminPaymentsPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <PaymentsOverview />;
}
