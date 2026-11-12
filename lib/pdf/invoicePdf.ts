import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type Color } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { DISPLAY_PHONE, SUPPORT_EMAIL, COMPANY_NAME, COMPANY_ADDRESS_LINES } from '@/lib/contact';

// Redesign 2026-09 (follow-up, 2026-11-04) — payment invoice PDF, Plot's
// request: "use existing design, colors, text that we are using for
// Verification report". Deliberately mirrors lib/pdf/visitReportPdf.ts's
// design tokens and low-level drawing helpers (masthead banner, divider
// rules, the three-up summary strip, the SURFACE+accent-bar highlight
// box, the footer) rather than importing them from that file — this file
// is self-contained on purpose, same as visitReportPdf.ts itself is, so
// a future change to one report's layout can't accidentally shift the
// other. If Plot later wants these two truly sharing one module, that's
// a separate, deliberate refactor — not bundled into this one.
//
// Step 2, confirmed by Plot (2026-11-04): a real sequential invoice
// number (lib/invoiceNumbering.ts, assigned at payment-confirmation
// time), no GST/tax line ever (NSR Ventures LLP isn't GST-registered),
// and the button lives in PaymentDetailActions.tsx/CustomPlanForm.tsx —
// see components/admin/invoice.actions.ts (getInvoicePdfData) and
// app/admin/payments/[id]/invoice/route.ts for the rest of this step.

const PAGE_W = 595.28; // A4 at 72dpi — same as visitReportPdf.ts
const PAGE_H = 841.89;
const MARGIN_X = 46;

// ---------- design tokens (identical values to visitReportPdf.ts, matching styles/plot360-redesign.css) ----------
const hex = (h: number, h2: number, h3: number) => [h / 255, h2 / 255, h3 / 255] as const;
const ACCENT = rgb(...hex(0x1e, 0x3a, 0x5f)); // --color-accent (Deep Navy)
const TEXT = rgb(...hex(0x20, 0x1e, 0x1d)); // --color-text
const SURFACE = rgb(...hex(0xea, 0xe9, 0xe9)); // --color-surface
const WHITE = rgb(1, 1, 1);

function mixWhite([r, g, b]: readonly [number, number, number], alpha: number): Color {
  return rgb(r * alpha + (1 - alpha), g * alpha + (1 - alpha), b * alpha + (1 - alpha));
}
const INK_SOFT = mixWhite(hex(0x20, 0x1e, 0x1d), 0.72);
const DIVIDER = mixWhite(hex(0x20, 0x1e, 0x1d), 0.4);

// ---------- date/number helpers ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDatePlain(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Redesign 2026-09 (follow-up, 2026-11-04, hotfix) — NOT "₹" (U+20B9).
// public/fonts/ has no real Archivo-*.ttf files yet (see its own
// README) — buildInvoicePdf falls back to pdf-lib's standard Helvetica,
// whose WinAnsi encoding can't represent the rupee sign at all, and
// pdf-lib throws rather than silently dropping it ("WinAnsi cannot
// encode '₹' (0x20b9)"), crashing the whole route with a 500. Every
// other character this file draws (· — em dash) is in WinAnsi and safe;
// this one wasn't. "Rs." has no such dependency on a font being present.
function formatRupees(n: number | null | undefined): string {
  return `Rs. ${Number(n ?? 0).toLocaleString('en-IN')}`;
}
function maskPhone(countryCode?: string | null, number?: string | null) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return 'Not on file';
  return `${countryCode ?? ''} ${digits}`.trim();
}

// ---------- low-level layout helpers (same approach as visitReportPdf.ts) ----------
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRule(page: PDFPage, x1: number, x2: number, y: number, thickness: number, color: Color) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text.toUpperCase(), { x, y, size: 7, font, color: INK_SOFT });
}

function drawFooter(page: PDFPage, fonts: Fonts, left: string, pageNum: number, pageCount: number) {
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, 56, 1.4, DIVIDER);
  page.drawText(left.toUpperCase(), { x: MARGIN_X, y: 40, size: 6.5, font: fonts.regular, color: INK_SOFT });
  const right = `PAGE ${pageNum} OF ${pageCount}`;
  const rightW = fonts.regular.widthOfTextAtSize(right, 6.5);
  page.drawText(right, { x: PAGE_W - MARGIN_X - rightW, y: 40, size: 6.5, font: fonts.regular, color: INK_SOFT });
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

// ---------- Archivo font files — same manual-add convention as visitReportPdf.ts ----------
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const ARCHIVO_REGULAR_PATH = path.join(FONT_DIR, 'Archivo-Regular.ttf');
const ARCHIVO_EXTRABOLD_PATH = path.join(FONT_DIR, 'Archivo-ExtraBold.ttf');

function loadArchivoBytes(): { regular: Buffer; extrabold: Buffer } | null {
  try {
    if (!existsSync(ARCHIVO_REGULAR_PATH) || !existsSync(ARCHIVO_EXTRABOLD_PATH)) return null;
    return { regular: readFileSync(ARCHIVO_REGULAR_PATH), extrabold: readFileSync(ARCHIVO_EXTRABOLD_PATH) };
  } catch {
    return null;
  }
}

async function embedFonts(pdfDoc: PDFDocument): Promise<Fonts> {
  const archivo = loadArchivoBytes();
  if (archivo) {
    try {
      pdfDoc.registerFontkit(fontkit);
      return {
        regular: await pdfDoc.embedFont(archivo.regular, { subset: true }),
        bold: await pdfDoc.embedFont(archivo.extrabold, { subset: true }),
      };
    } catch {
      // Fall through to Helvetica below rather than fail the whole invoice.
    }
  }
  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

// ---------- input shape ----------
// What recordPayment/fulfillCustomPlan/purchaseVisitCredits already have
// on hand the moment a payment is confirmed — see payments.actions.ts,
// customPlan.actions.ts and visitCredits.actions.ts. getInvoicePdfData()
// (step 2, not written yet) will assemble exactly this from those same
// rows; nothing here needs a new column.
export type InvoiceLineItem = { description: string; amount: number };

export type InvoiceData = {
  payment: {
    id: string;
    invoiceNumber: string; // real sequential number, see lib/invoiceNumbering.ts
    paidAt: string | null; // date payment was confirmed
    paymentMethod: string | null;
    transactionReference: string | null;
    amount: number;
    isCustomPlan: boolean;
    paymentType: 'initial' | 'renewal';
    validFrom: string | null;
    validUntil: string | null;
  };
  lineItems: InvoiceLineItem[]; // plan price (+ plot-size surcharge as its own line, when > 0)
  visitQuantity: number | null;
  property: {
    id: string;
    name: string;
    addressLine: string; // village/mandal/district, joined
  };
  customer: {
    name: string;
    email: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
  };
};

// ---------- the invoice itself ----------
export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const contentWidth = PAGE_W - MARGIN_X * 2;
  const invoiceNumber = data.payment.invoiceNumber;

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ---------------- Masthead — identical banner to visitReportPdf.ts's page 1 ----------------
  const mastheadH = 74;
  page.drawRectangle({ x: 0, y: PAGE_H - mastheadH, width: PAGE_W, height: mastheadH, color: ACCENT });
  page.drawText('PLOT360', { x: MARGIN_X, y: PAGE_H - 40, size: 21, font: fonts.bold, color: WHITE });
  page.drawText('PAYMENT INVOICE', { x: MARGIN_X, y: PAGE_H - 55, size: 8, font: fonts.regular, color: WHITE });
  const contactLines = ['plot360.in', `WhatsApp ${DISPLAY_PHONE}`, `Phone ${DISPLAY_PHONE}`, SUPPORT_EMAIL];
  contactLines.forEach((line, i) => {
    const w = fonts.regular.widthOfTextAtSize(line, 7.5);
    page.drawText(line, { x: PAGE_W - MARGIN_X - w, y: PAGE_H - 32 - i * 10.5, size: 7.5, font: fonts.regular, color: WHITE });
  });

  let y = PAGE_H - mastheadH - 24;
  const topLeft = `Invoice ${invoiceNumber}`;
  const topRight = `Issued ${formatDatePlain(data.payment.paidAt)}`;
  page.drawText(topLeft.toUpperCase(), { x: MARGIN_X, y, size: 7, font: fonts.regular, color: INK_SOFT });
  const topRightW = fonts.regular.widthOfTextAtSize(topRight.toUpperCase(), 7);
  page.drawText(topRight.toUpperCase(), { x: PAGE_W - MARGIN_X - topRightW, y, size: 7, font: fonts.regular, color: INK_SOFT });
  y -= 8;
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);

  // ---------------- Billed by / Billed to — two columns ----------------
  y -= 24;
  const colGap = 20;
  const colW = (contentWidth - colGap) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colW + colGap;
  const blockTopY = y;

  drawLabel(page, 'Billed by', leftX, blockTopY, fonts.regular);
  drawLabel(page, 'Billed to', rightX, blockTopY, fonts.regular);

  let leftY = blockTopY - 16;
  page.drawText(COMPANY_NAME, { x: leftX, y: leftY, size: 12, font: fonts.bold, color: TEXT });
  leftY -= 15;
  for (const line of COMPANY_ADDRESS_LINES) {
    page.drawText(line, { x: leftX, y: leftY, size: 8.5, font: fonts.regular, color: INK_SOFT });
    leftY -= 11;
  }
  page.drawText(SUPPORT_EMAIL, { x: leftX, y: leftY, size: 8.5, font: fonts.regular, color: INK_SOFT });
  leftY -= 11;

  let rightY = blockTopY - 16;
  page.drawText(data.customer.name || 'Property owner', { x: rightX, y: rightY, size: 12, font: fonts.bold, color: TEXT, maxWidth: colW });
  rightY -= 15;
  const propertyLines = wrapText(fonts.regular, `${data.property.name} — ${data.property.addressLine}`, 8.5, colW);
  for (const line of propertyLines) {
    page.drawText(line, { x: rightX, y: rightY, size: 8.5, font: fonts.regular, color: INK_SOFT });
    rightY -= 11;
  }
  if (data.customer.phoneNumber) {
    page.drawText(maskPhone(data.customer.phoneCountryCode, data.customer.phoneNumber), { x: rightX, y: rightY, size: 8.5, font: fonts.regular, color: INK_SOFT });
    rightY -= 11;
  }
  if (data.customer.email) {
    page.drawText(data.customer.email, { x: rightX, y: rightY, size: 8.5, font: fonts.regular, color: INK_SOFT });
    rightY -= 11;
  }

  y = Math.min(leftY, rightY) - 14;
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);

  // ---------------- Four-up summary strip — same pattern as visitReportPdf.ts's three-up ----------------
  const stripColW = contentWidth / 4;
  const stripTopY = y;
  const visitsText = data.visitQuantity ? `${data.visitQuantity} visit${data.visitQuantity === 1 ? '' : 's'}` : '—';
  const fourUp: [string, string][] = [
    ['Plan', data.payment.isCustomPlan ? 'Custom plan' : data.payment.paymentType === 'renewal' ? 'Renewal' : 'Initial'],
    ['Visits', visitsText],
    ['Valid until', formatDatePlain(data.payment.validUntil)],
    ['Status', 'Paid'],
  ];
  const stripBottomY = stripTopY - 40;
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, stripBottomY, 1.4, DIVIDER);
  fourUp.forEach(([label, value], i) => {
    const x = MARGIN_X + i * stripColW;
    drawLabel(page, label, x, stripTopY - 15, fonts.regular);
    page.drawText(value, { x, y: stripTopY - 30, size: 12.5, font: fonts.bold, color: TEXT });
    if (i > 0) page.drawLine({ start: { x, y: stripBottomY }, end: { x, y: stripTopY }, thickness: 0.7, color: DIVIDER });
  });
  y = stripBottomY - 26;

  // ---------------- Line items table ----------------
  drawLabel(page, 'Description', MARGIN_X, y, fonts.regular);
  const amountColX = PAGE_W - MARGIN_X - 80;
  drawLabel(page, 'Amount', amountColX, y, fonts.regular);
  y -= 10;
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);
  y -= 20;

  for (const item of data.lineItems) {
    const lines = wrapText(fonts.regular, item.description, 10, amountColX - MARGIN_X - 16);
    page.drawText(lines[0] ?? '', { x: MARGIN_X, y, size: 10, font: fonts.regular, color: TEXT });
    for (let i = 1; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN_X, y: y - i * 13, size: 10, font: fonts.regular, color: TEXT });
    }
    const amountText = formatRupees(item.amount);
    const amountW = fonts.regular.widthOfTextAtSize(amountText, 10);
    page.drawText(amountText, { x: PAGE_W - MARGIN_X - amountW, y, size: 10, font: fonts.regular, color: TEXT });
    y -= Math.max(20, lines.length * 13 + 6);
    drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, y, 0.7, DIVIDER);
    y -= 14;
  }

  y -= 4;
  const totalText = formatRupees(data.payment.amount);
  const totalLabelW = fonts.bold.widthOfTextAtSize('TOTAL PAID', 10.5);
  page.drawText('TOTAL PAID', { x: PAGE_W - MARGIN_X - 80 - totalLabelW - 14, y, size: 10.5, font: fonts.bold, color: TEXT });
  const totalW = fonts.bold.widthOfTextAtSize(totalText, 15);
  page.drawText(totalText, { x: PAGE_W - MARGIN_X - totalW, y: y - 2, size: 15, font: fonts.bold, color: ACCENT });
  y -= 36;

  // ---------------- Payment details — SURFACE highlight box, same pattern as visitReportPdf.ts's Summary box ----------------
  const detailRows: [string, string][] = [
    ['Payment method', data.payment.paymentMethod || '—'],
    ['Reference', data.payment.transactionReference || '—'],
    ['Paid on', formatDatePlain(data.payment.paidAt)],
    ['Valid from', formatDatePlain(data.payment.validFrom)],
  ];
  const boxTop = y;
  const boxH = 24 + detailRows.length * 15;
  page.drawRectangle({ x: MARGIN_X, y: boxTop - boxH, width: contentWidth, height: boxH, color: SURFACE });
  page.drawRectangle({ x: MARGIN_X, y: boxTop - boxH, width: 2.6, height: boxH, color: ACCENT });
  drawLabel(page, 'Payment details', MARGIN_X + 16, boxTop - 14, fonts.regular);
  let detailY = boxTop - 30;
  for (const [label, value] of detailRows) {
    page.drawText(label, { x: MARGIN_X + 16, y: detailY, size: 9, font: fonts.regular, color: INK_SOFT });
    page.drawText(value, { x: MARGIN_X + 150, y: detailY, size: 9, font: fonts.bold, color: TEXT });
    detailY -= 15;
  }

  // No GST/tax line, by design — Plot confirmed NSR Ventures LLP has no
  // GST registration, so this invoice never shows tax, only the plan,
  // price, and total paid.

  drawFooter(page, fonts, `${COMPANY_NAME} · invoice · ${invoiceNumber}`, 1, 1);

  return pdfDoc.save();
}
