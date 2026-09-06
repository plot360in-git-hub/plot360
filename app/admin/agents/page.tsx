import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AgentVerificationQueue } from '@/components/admin/AgentVerificationQueue';

export default async function AdminAgentsPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  return <AgentVerificationQueue />;
}
