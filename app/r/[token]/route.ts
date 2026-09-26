import { NextResponse } from 'next/server';
import { getVisitReportPdfDataByToken } from '@/components/customer/report-link.actions';
import { buildVisitReportPdf, propertyNameNoSpaces, formatDateForFilename } from '@/lib/pdf/visitReportPdf';

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: no-login mirror of
// app/properties/[id]/visit-report/[jobId]/pdf/route.ts, for the WhatsApp
// "your visit report is ready" link. WhatsApp's in-app browser has no
// session cookies, so the cookie-authenticated route always served a
// plain 404 there. This route is reached with just a long random token
// (see components/customer/report-link.actions.ts and the
// visit_report_tokens table) instead of a session — the token itself is
// the credential, validated with a service-role client that bypasses
// RLS. An invalid, expired, or not-yet-approved token gets the same
// generic 404 text as the authenticated route, so this never leaks
// whether a given token or job exists.
//
// The authenticated route at /properties/[id]/visit-report/[jobId]/pdf
// is untouched and still used by the in-app "Download PDF" button
// (components/customer/VisitReportView.tsx) for a customer already
// logged into the app — this is a new route beside it, not a
// replacement.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getVisitReportPdfDataByToken(token);
  if ('error' in result) {
    return new NextResponse(result.error, { status: 404 });
  }

  const { data } = result;
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
