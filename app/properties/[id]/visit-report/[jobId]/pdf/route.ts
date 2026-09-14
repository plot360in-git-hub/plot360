import { NextResponse } from 'next/server';
import { getVisitReportPdfData } from '@/components/properties/monitoring/monitoring.actions';
import { buildVisitReportPdf, propertyNameNoSpaces, formatDateForFilename } from '@/lib/pdf/visitReportPdf';

// Redesign 2026-09 — the visit report as a real downloadable PDF
// (design_handoff_plot360_redesign, "Report-A-Record.dc.html"). RLS on
// monitoring_jobs (monitoring_jobs_select_owner / _select_admin) is what
// actually gates access — getVisitReportPdfData returns null for anyone
// else's job, or for a job not yet approved/ec_pending, and both become
// a plain 404 here rather than leaking whether the job exists.
//
// The old print-HTML page at the sibling /visit-report/[jobId] route is
// untouched and still reachable directly — this is a new route beside
// it, not a replacement, per the "don't rewrite without asking" rule.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { jobId } = await params;
  const data = await getVisitReportPdfData(jobId);
  if (!data) {
    return new NextResponse('This visit report is not available.', { status: 404 });
  }

  const pdfBytes = await buildVisitReportPdf(data);
  const reportDate = data.job.decided_at ?? data.job.submitted_at;
  const filename = `Plot360_${propertyNameNoSpaces(data.property.property_name)}_Visit${data.job.visit_number ?? 1}_${formatDateForFilename(reportDate)}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
