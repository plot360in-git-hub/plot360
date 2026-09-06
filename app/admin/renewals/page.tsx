import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { RenewalsQueue } from '@/components/admin/RenewalsQueue';

export default async function AdminRenewalsPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <RenewalsQueue />;
}
