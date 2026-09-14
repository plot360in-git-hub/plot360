import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { ServiceRequestDetailAdmin } from '@/components/admin/ServiceRequestDetailAdmin';

// Redesign 2026-09 — swapped to the new admin-only Service request
// detail screen. ServiceRequestThread.tsx is untouched and still used
// by the customer-facing /service-requests/[id] route — see
// ARCHITECTURE.md.
export default async function AdminServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  return <ServiceRequestDetailAdmin requestId={id} />;
}
