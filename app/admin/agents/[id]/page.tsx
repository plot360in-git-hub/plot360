import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AgentReview } from '@/components/admin/AgentReview';

export default async function AdminAgentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { id } = await params;
  return <AgentReview agentId={id} />;
}
