import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { SubmissionReviewScreen } from '@/components/admin/SubmissionReviewScreen';

// Redesign 2026-09 — swapped to the new Submission review screen.
// MonitoringJobReview.tsx is kept intact but no longer wired here — see
// ARCHITECTURE.md.
export default async function AdminMonitoringJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');
  const { jobId } = await params;
  return <SubmissionReviewScreen jobId={jobId} />;
}
