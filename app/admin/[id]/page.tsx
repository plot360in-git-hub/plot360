import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { PropertyVerificationDetail } from '@/components/admin/PropertyVerificationDetail';

// Redesign 2026-09 — swapped to the new Property verification detail
// screen. AdminReview.tsx is kept intact but no longer wired here — see
// ARCHITECTURE.md.
export default async function AdminReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { id } = await params;
  return <PropertyVerificationDetail propertyId={id} />;
}
