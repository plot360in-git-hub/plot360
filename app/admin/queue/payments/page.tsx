import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getPaymentsQueue } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

export default async function PaymentsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getPaymentsQueue({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Payments"
      note="Bank transfers awaiting confirmation. UPI payments confirm themselves."
      colA="Property"
      colB="Customer"
      colD="Amount"
      searchPlaceholder="Search property or customer"
      sorts={[
        { key: 'urgent', label: 'Mismatches first' },
        { key: 'amount', label: 'Largest amount' },
        { key: 'oldest', label: 'Oldest waiting' },
      ]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
