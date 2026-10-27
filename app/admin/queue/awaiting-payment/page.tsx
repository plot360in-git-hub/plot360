import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getAwaitingPaymentQueue } from '@/components/admin/queues.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

// Redesign 2026-09 (follow-up, 2026-10-27) — Plot: a property that's
// registered — and can even already be admin-verified — but whose owner
// never completed payment had no trace anywhere else (see
// getAwaitingPaymentQueue's own note, queues.actions.ts, for the full
// gap). Mirrors app/admin/queue/custom-plans/page.tsx — same QueueScreen
// shell, every row opens straight into the property's own admin page.
export default async function AwaitingPaymentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getAwaitingPaymentQueue({ query: sp.q, sort: sp.sort as any, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Awaiting payment"
      note="Registered properties with no payment on file at all — the owner never finished Step 2. Call them, or point them at the custom plan option."
      colA="Property"
      colB="Location"
      colD="Status"
      searchPlaceholder="Search property or location"
      sorts={[{ key: 'urgent', label: 'Verified first' }, { key: 'oldest', label: 'Oldest waiting' }]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
