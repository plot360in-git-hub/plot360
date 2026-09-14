import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getJobAssignmentQueue } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

export default async function JobAssignmentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getJobAssignmentQueue({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Job assignment"
      note="Paid visits waiting for an agent. Default order puts paid-but-unassigned first."
      colA="Property"
      colB="Location · SRO"
      colD="Window"
      searchPlaceholder="Search property, customer or state"
      sorts={[
        { key: 'urgent', label: 'Paid but unassigned' },
        { key: 'oldest', label: 'Oldest waiting' },
      ]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
