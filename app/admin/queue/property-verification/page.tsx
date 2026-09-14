import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getPropertyVerificationQueue } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

export default async function PropertyVerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getPropertyVerificationQueue({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Property verification"
      note="Registrations waiting for document collection, SRO details and owner approval."
      colA="Property"
      colB="Location · SRO"
      colD="Plan"
      searchPlaceholder="Search property, customer or state"
      sorts={[
        { key: 'urgent', label: 'Most urgent first' },
        { key: 'oldest', label: 'Oldest waiting' },
      ]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
