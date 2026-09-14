import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AgentVerificationDetail } from '@/components/admin/AgentVerificationDetail';

// Redesign 2026-09 — swapped to the new Agent verification detail
// screen. AgentReview.tsx is kept intact but no longer wired here — see
// ARCHITECTURE.md.
export default async function AdminAgentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { id } = await params;
  return <AgentVerificationDetail agentId={id} />;
}
