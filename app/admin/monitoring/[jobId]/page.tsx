import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { MonitoringJobReview } from '@/components/admin/MonitoringJobReview';

export default async function AdminMonitoringJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { jobId } = await params;
  return <MonitoringJobReview jobId={jobId} />;
}
