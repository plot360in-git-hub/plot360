import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getCustomPlanQueue } from '@/components/admin/customPlan.actions';
import { QueueScreen } from '@/components/admin/QueueScreen';

// Redesign 2026-09 (follow-up, 2026-10-03) — custom visit plans. Mirrors
// app/admin/queue/payments/page.tsx — same QueueScreen shell, its own
// getCustomPlanQueue() data (see customPlan.actions.ts), and every row
// opens straight into the property's own admin page rather than a
// separate detail route, since that's where the "Custom plan" panel
// (PropertyVerificationDetail.tsx) actually lives.
export default async function CustomPlansQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const sp = await searchParams;
  const result = await getCustomPlanQueue({ query: sp.q, page: sp.page ? Number(sp.page) : 1 });

  return (
    <QueueScreen
      title="Custom plans"
      note="Customers who asked for a custom visit plan on the payment screen — call them, then fill in what you agreed."
      colA="Property"
      colB="Customer"
      colD="Amount"
      searchPlaceholder="Search property or customer"
      sorts={[{ key: 'oldest', label: 'Oldest waiting' }]}
      result={result}
      query={sp.q ?? ''}
    />
  );
}
