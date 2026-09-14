import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getAgentVerificationQueueRows } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

export default async function AgentVerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getAgentVerificationQueueRows({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Agent verification"
      note="New agents and updated documents. Verify the mobile number and SRO before assigning work."
      colA="Agent"
      colB="SRO"
      colD="Documents"
      searchPlaceholder="Search agent, SRO or number"
      sorts={[
        { key: 'urgent', label: 'Missing documents first' },
        { key: 'oldest', label: 'Oldest waiting' },
      ]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
