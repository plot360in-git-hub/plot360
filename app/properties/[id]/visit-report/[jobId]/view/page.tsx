import { VisitReportView } from '@/components/customer/VisitReportView';

// Redesign 2026-09 (follow-up, round 26) — the redesigned in-app visit
// report screen (see VisitReportView.tsx for why this is a new route
// beside /visit-report/[jobId] rather than a rewrite of it).
export default async function VisitReportViewPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { id, jobId } = await params;
  return <VisitReportView propertyId={id} jobId={jobId} />;
}
