import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getServiceRequestsQueue } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

// Redesign 2026-09 — replaces the flat list at app/admin/service-requests
// (kept intact, still reachable) with the design's queue table. The
// underlying detail screen stays at /admin/service-requests/[id] — see
// that route's own redesign.
export default async function ServiceRequestsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getServiceRequestsQueue({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Service requests"
      note="Customer questions and concerns. Answers go out on WhatsApp."
      colA="Request"
      colB="Customer"
      colD="Attachment"
      searchPlaceholder="Search request or customer"
      sorts={[
        { key: 'urgent', label: 'Follow-ups first' },
        { key: 'oldest', label: 'Oldest waiting' },
      ]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
