import { NextResponse } from 'next/server';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getInvoicePdfData } from '@/components/admin/invoice.actions';
import { buildInvoicePdf } from '@/lib/pdf/invoicePdf';

// Redesign 2026-09 (follow-up, 2026-11-04) — invoice generation, step 2.
// Admin-only PDF download, mirrors the visit-report PDF route's pattern
// exactly (app/properties/[id]/visit-report/[jobId]/pdf/route.ts): a
// route handler does its own admin check here, since app/admin/layout.tsx
// only wraps pages, not route handlers. getInvoicePdfData also gates
// itself, same defense-in-depth as every other admin action.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate !== 'ok') return new NextResponse('Not found.', { status: 404 });

  const { id } = await params;
  const data = await getInvoicePdfData(id);
  if (!data) return new NextResponse('This invoice is not available.', { status: 404 });

  const pdfBytes = await buildInvoicePdf(data);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Plot360_${data.payment.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
