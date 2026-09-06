import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AdminReview } from '@/components/admin/AdminReview';

export default async function AdminReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { id } = await params;
  return <AdminReview propertyId={id} />;
}
