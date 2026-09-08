import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AdminUsersList } from '@/components/admin/AdminUsersList';

export default async function AdminUsersPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <AdminUsersList />;
}
