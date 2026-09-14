import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { PaymentDetail } from '@/components/admin/PaymentDetail';

// Redesign 2026-09 — admin console, new Payment detail route. Doesn't
// collide with the existing app/admin/payments/page.tsx index (kept
// intact, unreferenced from the nav — see ARCHITECTURE.md).
export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  return <PaymentDetail paymentId={id} />;
}
