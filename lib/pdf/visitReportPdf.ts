import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type Color } from 'pdf-lib';
import { VISIT_QUESTIONS, isConcerningAnswer } from '@/lib/visitReportQuestions';

// Redesign 2026-09 — the 4-page A4 visit report (design_handoff_
// plot360_redesign, "Report-A-Record.dc.html"), generated server-side.
//
// The README's own instruction was "Puppeteer or similar" — this uses
// pdf-lib instead of a headless browser. Two reasons: (1) this sandbox
// cannot install any new package at all (npm registry returns 403 here),
// so whichever library is chosen has to be added to package.json and
// installed for real on the user's own machine regardless — pdf-lib is
// the lighter, dependency-free choice (pure JS, no Chromium download,
// serverless-friendly); (2) page 4 needs to embed the customer's actual
// uploaded EC file, which can itself be a PDF — pdf-lib can load and
// copy pages from an arbitrary existing PDF directly (see embedEcPage
// below), which a browser-print approach can't do at all. This is a
// deliberate deviation from "Puppeteer or similar" flagged for the user.
//
// Typography: the design's Archivo font isn't available to embed here
// (no font file in the design bundle, and fetching Google Fonts from
// this sandbox isn't reliable) — Helvetica/Helvetica-Bold are used
// instead. Colour tokens, layout, rules and content structure otherwise
// follow the design mock page-for-page.

const PAGE_W = 595.28; // A4 at 72dpi
const PAGE_H = 841.89;
const MARGIN_X = 46;

// ---------- design tokens (hex → 0-1, matching the handoff's table) ----------
const hex = (h: number, h2: number, h3: number) => [h / 255, h2 / 255, h3 / 255] as const;
const ACCENT = rgb(...hex(0xec, 0x30, 0x13));
const ACCENT_700 = rgb(...hex(0xae, 0x18, 0x00));
const TEXT = rgb(...hex(0x20, 0x1e, 0x1d));
const SURFACE = rgb(...hex(0xea, 0xe9, 0xe9));
const WHITE = rgb(1, 1, 1);
const NEUTRAL_300 = rgb(...hex(0xda, 0xd8, 0xd7));
const NEUTRAL_400 = rgb(...hex(0xc4, 0xc1, 0xc0));

function mixWhite([r, g, b]: readonly [number, number, number], alpha: number): Color {
  return rgb(r * alpha + (1 - alpha), g * alpha + (1 - alpha), b * alpha + (1 - alpha));
}
const INK_SOFT = mixWhite(hex(0x20, 0x1e, 0x1d), 0.72);
const DIVIDER = mixWhite(hex(0x20, 0x1e, 0x1d), 0.4);

// ---------- date/text helpers ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BOUNDARY_LABELS: Record<string, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };

function toIST(iso: string): Date {
  return new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000);
}
function formatDatePlain(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toIST(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function formatTimeIST(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = toIST(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} IST`;
}
export function formatDateForFilename(iso: string | null | undefined): string {
  const d = iso ? toIST(iso) : toIST(new Date().toISOString());
  return `${d.getUTCDate()}${MONTHS[d.getUTCMonth()]}${d.getUTCFullYear()}`;
}
function formatWindow(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return 'Not scheduled';
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sMonth = MONTHS[s.getUTCMonth()];
  const eMonth = MONTHS[e.getUTCMonth()];
  if (sMonth === eMonth && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${s.getUTCDate()}–${e.getUTCDate()} ${sMonth} ${s.getUTCFullYear()}`;
  }
  return `${s.getUTCDate()} ${sMonth} ${s.getUTCFullYear()} – ${e.getUTCDate()} ${eMonth} ${e.getUTCFullYear()}`;
}

export function propertyNameNoSpaces(name: string | null | undefined) {
  return (name || 'Property').replace(/\s+/g, '');
}

function maskPhone(countryCode: string | null | undefined, number: string | null | undefined) {
  const digits = (number || '').replace(/\D/g, '');
  if (digits.length < 6) return digits ? `${countryCode ?? ''}${digits}` : 'Not on file';
  return `${digits.slice(0, 4)} ••• ${digits.slice(-2)}`;
}

function reportCodeFor(propertyId: string) {
  return `P-${propertyId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}
function agentCodeFor(agentId: string | null | undefined) {
  if (!agentId) return 'FA-000';
  const n = parseInt(agentId.replace(/-/g, '').slice(0, 3), 16) || 0;
  return `FA-${(n % 900) + 100}`;
}

function composeSummary(job: any): string {
  const vacant = !!job.q_vacant_as_expected;
  const boundary = !!job.q_boundary_intact;
  const parts: string[] = [`The plot is ${vacant ? 'vacant, as expected' : 'not vacant, as expected'}, and its boundary is ${boundary ? 'intact' : 'not fully intact'}.`];

  const concerns: string[] = [];
  if (job.q_encroachment) concerns.push('signs of encroachment');
  if (job.q_illegal_dumping) concerns.push('illegal dumping or debris');
  if (job.q_unauthorized_construction) concerns.push('unauthorized construction or activity');
  if (job.q_govt_notice_posted) concerns.push('a government/municipal notice posted on site');
  if (job.q_water_logging) concerns.push('a water logging or drainage issue');
  if (job.q_boundary_markers_visible === false) concerns.push('boundary markers/pillars not fully visible');

  const attention = String(job.q_attention_needed || '').trim();
  const attentionMeaningful = attention.length > 0 && !['none', 'no', 'n/a', 'na'].includes(attention.toLowerCase());

  if (concerns.length === 0 && !attentionMeaningful) {
    parts.push('No encroachment, construction or government notice was observed.');
  } else {
    if (concerns.length) parts.push(`Items to note: ${concerns.join(', ')}.`);
    if (attentionMeaningful) parts.push(`For the owner's attention: ${attention}.`);
  }
  return parts.join(' ');
}

function composeChangeSummary(current: any, previous: any): string | null {
  if (!previous) return null;
  const changes: string[] = [];
  for (const q of VISIT_QUESTIONS) {
    const a = previous[q.key];
    const b = current[q.key];
    if (q.type === 'boolean') {
      if (!!a !== !!b) changes.push(`${q.label} — was ${a ? 'Yes' : 'No'}, now ${b ? 'Yes' : 'No'}.`);
    } else {
      const av = String(a || '').trim();
      const bv = String(b || '').trim();
      if (av !== bv) changes.push(`${q.label} — was "${av || '—'}", now "${bv || '—'}".`);
    }
  }
  return changes.length === 0 ? 'No change from the previous visit — every check came back the same way.' : changes.join(' ');
}

// ---------- low-level layout helpers ----------
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

function drawParagraph(
  page: PDFPage,
  text: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: Color; maxWidth: number; lineHeight: number }
): number {
  const lines = wrapText(opts.font, text, opts.size, opts.maxWidth);
  let cursorY = opts.y;
  for (const line of lines) {
    page.drawText(line, { x: opts.x, y: cursorY, size: opts.size, font: opts.font, color: opts.color });
    cursorY -= opts.lineHeight;
  }
  return cursorY;
}

function drawRule(page: PDFPage, x1: number, x2: number, y: number, thickness: number, color: Color) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
}

function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont) {
  page.drawText(text.toUpperCase(), { x, y, size: 7, font, color: INK_SOFT });
}

// Chrome shared by pages 2-4: small wordmark + right-aligned context line,
// divider, and a footer divider + two-column footer text.
function drawSecondaryHeader(page: PDFPage, fonts: Fonts, right: string) {
  page.drawText('PLOT', { x: MARGIN_X, y: PAGE_H - 40, size: 11, font: fonts.bold, color: TEXT });
  const w = fonts.bold.widthOfTextAtSize('PLOT', 11);
  page.drawText('360', { x: MARGIN_X + w, y: PAGE_H - 40, size: 11, font: fonts.bold, color: ACCENT });
  const rightW = fonts.regular.widthOfTextAtSize(right.toUpperCase(), 7);
  page.drawText(right.toUpperCase(), { x: PAGE_W - MARGIN_X - rightW, y: PAGE_H - 38, size: 7, font: fonts.regular, color: INK_SOFT });
  drawRule(page, MARGIN_X, PAGE_W - MARGIN_X, PAGE_H - 50, 1.4, DIVIDER);
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

// ---------- image embedding ----------
async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, contentType };
  } catch {
    return null;
  }
}

async function embedImageBytes(pdfDoc: PDFDocument, bytes: Uint8Array, contentType: string) {
  const isPng = contentType.includes('png') || (bytes[0] === 0x89 && bytes[1] === 0x50);
  try {
    return isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  } catch {
    try {
      return isPng ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

// ---------- public data shape ----------
export interface VisitReportPdfInput {
  job: any;
  property: any;
  owner: any;
  ecRequested: boolean;
  ec: { filePath: string; url: string | null } | null;
  ownerVerifiedAt: string | null;
  previousJob: any | null;
  photos: { url: string; boundarySide: string | null }[];
  videoCount: number;
}

export async function buildVisitReportPdf(data: VisitReportPdfInput): Promise<Uint8Array> {
  const { job, property, owner } = data;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Plot360 site visit record — ${property.property_name ?? ''} — Visit ${job.visit_number ?? ''}`);
  pdfDoc.setProducer('Plot360');
  const fonts: Fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  // Whether page 4 (EC annexure) is included, and whether we can embed a
  // real EC (image inline, or PDF pages copied in as received) or only a
  // "still being processed" notice.
  const includeEcPage = data.ecRequested;
  const contentWidth = PAGE_W - MARGIN_X * 2;

  // ---------------- Page 1 — masthead, summary ----------------
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const mastheadH = 74;
  page1.drawRectangle({ x: 0, y: PAGE_H - mastheadH, width: PAGE_W, height: mastheadH, color: ACCENT });
  page1.drawText('PLOT360', { x: MARGIN_X, y: PAGE_H - 40, size: 21, font: fonts.bold, color: WHITE });
  page1.drawText('SITE VISIT RECORD', { x: MARGIN_X, y: PAGE_H - 55, size: 8, font: fonts.regular, color: WHITE });
  const contactLines = ['plot360.in', 'WhatsApp +91 90000 36000', 'Phone +91 90000 36000', 'support@plot360.in'];
  contactLines.forEach((line, i) => {
    const w = fonts.regular.widthOfTextAtSize(line, 7.5);
    page1.drawText(line, { x: PAGE_W - MARGIN_X - w, y: PAGE_H - 32 - i * 10.5, size: 7.5, font: fonts.regular, color: WHITE });
  });

  let y = PAGE_H - mastheadH - 24;
  const reportCode = reportCodeFor(property.id);
  const topLeft = `Page 1 of ${includeEcPage ? 4 : 3} · ${reportCode}`;
  const topRight = `Issued ${formatDatePlain(new Date().toISOString())}`;
  page1.drawText(topLeft.toUpperCase(), { x: MARGIN_X, y, size: 7, font: fonts.regular, color: INK_SOFT });
  const topRightW = fonts.regular.widthOfTextAtSize(topRight.toUpperCase(), 7);
  page1.drawText(topRight.toUpperCase(), { x: PAGE_W - MARGIN_X - topRightW, y, size: 7, font: fonts.regular, color: INK_SOFT });
  y -= 8;
  drawRule(page1, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);

  y -= 36;
  page1.drawText(property.property_name || 'Property', { x: MARGIN_X, y, size: 27, font: fonts.bold, color: TEXT });
  y -= 18;
  const addressLine = [property.village_town, property.mandal_taluka, property.district].filter(Boolean).join(', ');
  const sizeLine = property.plot_size ? ` · ${property.plot_size} ${property.plot_size_unit || 'sq yd'}` : '';
  page1.drawText(`${addressLine || 'Address not yet recorded'}${sizeLine}`, { x: MARGIN_X, y, size: 10.5, font: fonts.regular, color: INK_SOFT });

  // three-up summary
  y -= 26;
  const topRuleY = y;
  const colW = contentWidth / 3;
  const concerningCount = VISIT_QUESTIONS.filter((q) => isConcerningAnswer(q.key, job[q.key])).length;
  const verdictText = concerningCount === 0 ? 'No issues found' : concerningCount === 1 ? 'One item to note' : `${concerningCount} items to note`;
  const visitedDate = formatDateIST(job.decided_at ?? job.submitted_at);
  const evidenceText = `${data.photos.length} photo${data.photos.length === 1 ? '' : 's'}${data.videoCount ? ` · ${data.videoCount} video${data.videoCount === 1 ? '' : 's'}` : ''}`;
  const threeUp: [string, string, Color][] = [
    ['Visited', visitedDate, TEXT],
    ['Verdict', verdictText, concerningCount > 0 ? ACCENT_700 : TEXT],
    ['Evidence', evidenceText, TEXT],
  ];
  drawRule(page1, MARGIN_X, PAGE_W - MARGIN_X, topRuleY, 1.4, DIVIDER);
  const rowBottomY = topRuleY - 40;
  drawRule(page1, MARGIN_X, PAGE_W - MARGIN_X, rowBottomY, 1.4, DIVIDER);
  threeUp.forEach(([label, value, color], i) => {
    const x = MARGIN_X + i * colW;
    drawLabel(page1, label, x, topRuleY - 15, fonts.regular);
    page1.drawText(value, { x, y: topRuleY - 30, size: 12.5, font: fonts.bold, color });
    if (i > 0) page1.drawLine({ start: { x, y: rowBottomY }, end: { x, y: topRuleY }, thickness: 0.7, color: DIVIDER });
  });
  y = rowBottomY - 22;

  // detail table
  const detailRows: [string, string][] = [
    ['Issued to', `${[owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || 'Property owner'} · ${maskPhone(owner?.phone_country_code, owner?.phone_number)}${data.ownerVerifiedAt ? ` (owner verified ${formatDatePlain(data.ownerVerifiedAt)})` : ''}`],
    ['SRO', `${property.sro_name || 'Not recorded'}${property.sro_code ? ` · SRO ${property.sro_code}` : ''}`],
    ['Map pin', property.plot_gps_coordinate || (property.google_map_lat && property.google_map_lng ? `${property.google_map_lat}, ${property.google_map_lng}` : 'Not recorded')],
    ['Visit window', `${formatWindow(job.requested_window_start, job.requested_window_end)}${job.submitted_at ? ` · attended ${formatDateIST(job.submitted_at)}, ${formatTimeIST(job.submitted_at)}` : ''}`],
    ['Field agent', `Plot360 verified agent · ${agentCodeFor(job.agent_id)}`],
    ['EC copy', data.ecRequested ? 'Requested — see page 4' : 'Not requested'],
  ];
  const labelColW = 110;
  for (const [label, value] of detailRows) {
    const rowLines = wrapText(fonts.regular, value, 9.5, contentWidth - labelColW);
    const rowH = Math.max(16, rowLines.length * 12 + 4);
    page1.drawText(label, { x: MARGIN_X, y: y - 10, size: 9.5, font: fonts.regular, color: INK_SOFT });
    let vy = y - 10;
    for (const line of rowLines) {
      page1.drawText(line, { x: MARGIN_X + labelColW, y: vy, size: 9.5, font: fonts.bold, color: TEXT });
      vy -= 12;
    }
    y -= rowH;
    drawRule(page1, MARGIN_X, PAGE_W - MARGIN_X, y, 0.7, DIVIDER);
  }

  // summary block
  y -= 16;
  const summaryTop = y;
  const summaryText = composeSummary(job);
  const summaryLines = wrapText(fonts.regular, summaryText, 9.5, contentWidth - 36);
  const summaryH = 26 + summaryLines.length * 13;
  page1.drawRectangle({ x: MARGIN_X, y: summaryTop - summaryH, width: contentWidth, height: summaryH, color: SURFACE });
  page1.drawRectangle({ x: MARGIN_X, y: summaryTop - summaryH, width: 2.6, height: summaryH, color: ACCENT });
  drawLabel(page1, 'Summary', MARGIN_X + 16, summaryTop - 14, fonts.regular);
  drawParagraph(page1, summaryText, { x: MARGIN_X + 16, y: summaryTop - 28, size: 9.5, font: fonts.regular, color: TEXT, maxWidth: contentWidth - 36, lineHeight: 13 });
  y = summaryTop - summaryH - 18;

  // what changed since visit N
  const changeText = composeChangeSummary(job, data.previousJob);
  if (changeText && data.previousJob) {
    drawLabel(page1, `What changed since visit ${data.previousJob.visit_number ?? '—'} · ${formatDatePlain(data.previousJob.decided_at ?? data.previousJob.submitted_at)}`, MARGIN_X, y, fonts.regular);
    y -= 14;
    y = drawParagraph(page1, changeText, { x: MARGIN_X, y, size: 9.5, font: fonts.regular, color: TEXT, maxWidth: contentWidth, lineHeight: 13 });
  }

  drawFooter(page1, fonts, `Plot360 · site visit record · ${reportCode}/V${job.visit_number ?? ''}`, 1, includeEcPage ? 4 : 3);

  // ---------------- Page 2 — checks table + observations ----------------
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSecondaryHeader(page2, fonts, `${property.property_name} · Visit ${job.visit_number ?? ''} · ${formatDateIST(job.decided_at ?? job.submitted_at)}`);
  y = PAGE_H - 90;
  page2.drawText('On-site checks', { x: MARGIN_X, y, size: 19, font: fonts.bold, color: TEXT });
  y -= 16;
  y = drawParagraph(page2, 'Ten fixed checks answered on site by the field agent. Items in red are the ones we ask you to read.', {
    x: MARGIN_X,
    y,
    size: 9,
    font: fonts.regular,
    color: INK_SOFT,
    maxWidth: contentWidth,
    lineHeight: 12,
  });
  y -= 10;
  drawRule(page2, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);
  y -= 14;
  const answerColX = MARGIN_X + contentWidth - 190;
  for (const q of VISIT_QUESTIONS) {
    const value = job[q.key];
    const display = q.type === 'boolean' ? (value ? 'Yes' : 'No') : value || '—';
    const concerning = isConcerningAnswer(q.key, value);
    const labelLines = wrapText(fonts.regular, q.label, 9.5, answerColX - MARGIN_X - 14);
    const valueLines = wrapText(fonts.bold, display, 9.5, contentWidth - (answerColX - MARGIN_X) - 4);
    const rowLines = Math.max(labelLines.length, valueLines.length);
    const rowH = rowLines * 12 + 6;
    labelLines.forEach((line, i) => page2.drawText(line, { x: MARGIN_X, y: y - 9 - i * 12, size: 9.5, font: fonts.regular, color: TEXT }));
    valueLines.forEach((line, i) => page2.drawText(line, { x: answerColX, y: y - 9 - i * 12, size: 9.5, font: fonts.bold, color: concerning ? ACCENT_700 : TEXT }));
    y -= rowH;
    drawRule(page2, MARGIN_X, PAGE_W - MARGIN_X, y, 0.7, DIVIDER);
  }

  y -= 18;
  const colGap = 22;
  const halfW = (contentWidth - colGap) / 2;
  const obsX = MARGIN_X;
  const commentsX = MARGIN_X + halfW + colGap;
  drawRule(page2, MARGIN_X, PAGE_W - MARGIN_X, y, 1.4, DIVIDER);
  y -= 16;
  drawLabel(page2, 'Field agent observations', obsX, y, fonts.regular);
  drawLabel(page2, 'Plot360 review comments', commentsX, y, fonts.regular);
  y -= 14;
  const obsText = job.observations?.trim() || 'No additional notes from the field agent.';
  const commentsText = job.admin_remarks?.trim() || 'No additional remarks.';
  drawParagraph(page2, obsText, { x: obsX, y, size: 9.5, font: fonts.regular, color: TEXT, maxWidth: halfW, lineHeight: 12.5 });
  let commentsEndY = drawParagraph(page2, commentsText, { x: commentsX, y, size: 9.5, font: fonts.regular, color: TEXT, maxWidth: halfW, lineHeight: 12.5 });
  if (job.decided_at) {
    commentsEndY -= 8;
    page2.drawText(`Reviewed and approved by Plot360 operations · ${formatDatePlain(job.decided_at)}`, {
      x: commentsX,
      y: commentsEndY,
      size: 8.5,
      font: fonts.regular,
      color: INK_SOFT,
    });
  }

  drawFooter(page2, fonts, 'plot360.in · WhatsApp +91 90000 36000', 2, includeEcPage ? 4 : 3);

  // ---------------- Page 3 — photographs ----------------
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSecondaryHeader(page3, fonts, `Photographic record · ${formatDateIST(job.decided_at ?? job.submitted_at)}`);
  y = PAGE_H - 90;
  page3.drawText('Photographic record', { x: MARGIN_X, y, size: 19, font: fonts.bold, color: TEXT });
  y -= 16;

  // How many photos actually fit determines the note's wording ("Six of
  // eighteen photographs...") — worked out from a pessimistic 2-line
  // budget for the note itself, so the grid never overflows regardless
  // of how the final note text happens to wrap.
  const gap = 16;
  const tileW = (contentWidth - gap) / 2;
  const tileH = tileW * 0.75; // 4:3
  const bottomLimit = 70;
  const rowStride = tileH + 26;
  const noteBudget = 2 * 12 + 8;
  const maxRows = Math.max(1, Math.floor((y - noteBudget - bottomLimit) / rowStride) + 1);
  const maxPhotosShown = maxRows * 2;
  const shownPhotos = data.photos.slice(0, maxPhotosShown);
  const hiddenCount = data.photos.length - shownPhotos.length;

  const photoNote =
    hiddenCount > 0
      ? `${shownPhotos.length} of ${data.photos.length} photographs.${data.videoCount ? ` ${data.videoCount} video${data.videoCount === 1 ? '' : 's'} and the` : ' The'} full set ${data.videoCount ? 'are' : 'is'} in your Plot360 account.`
      : `${data.photos.length} photograph${data.photos.length === 1 ? '' : 's'}${data.videoCount ? ` and ${data.videoCount} video${data.videoCount === 1 ? '' : 's'}` : ''} from this visit.`;
  y = drawParagraph(page3, photoNote, { x: MARGIN_X, y, size: 9, font: fonts.regular, color: INK_SOFT, maxWidth: contentWidth, lineHeight: 12 });
  y -= 14;

  let col = 0;
  let rowTopY = y;
  for (let i = 0; i < shownPhotos.length; i++) {
    if (rowTopY - tileH < bottomLimit) break; // safety net; maxRows above should already prevent this
    const photo = shownPhotos[i];
    const x = MARGIN_X + col * (tileW + gap);
    const fetched = await fetchBytes(photo.url);
    const img = fetched ? await embedImageBytes(pdfDoc, fetched.bytes, fetched.contentType) : null;
    if (img) {
      const scale = Math.min(tileW / img.width, tileH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      page3.drawRectangle({ x, y: rowTopY - tileH, width: tileW, height: tileH, color: NEUTRAL_300 });
      page3.drawImage(img, { x: x + (tileW - drawW) / 2, y: rowTopY - tileH + (tileH - drawH) / 2, width: drawW, height: drawH });
    } else {
      page3.drawRectangle({ x, y: rowTopY - tileH, width: tileW, height: tileH, color: NEUTRAL_400 });
      page3.drawText('Photo unavailable', { x: x + 8, y: rowTopY - tileH + 8, size: 8, font: fonts.regular, color: TEXT });
    }
    const caption = photo.boundarySide ? `${BOUNDARY_LABELS[photo.boundarySide] ?? photo.boundarySide} boundary` : `Photograph ${String(i + 1).padStart(2, '0')}`;
    page3.drawText(caption, { x, y: rowTopY - tileH - 12, size: 8, font: fonts.regular, color: TEXT });

    if (col === 1) {
      col = 0;
      rowTopY -= tileH + 26;
    } else {
      col = 1;
    }
  }

  drawFooter(page3, fonts, 'Photographs are unedited and timestamped at capture', 3, includeEcPage ? 4 : 3);

  // ---------------- Page 4 — EC annexure (only when requested) ----------------
  if (includeEcPage) {
    const page4 = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawSecondaryHeader(page4, fonts, 'Annexure · requested by owner');
    y = PAGE_H - 90;
    page4.drawText('Encumbrance certificate', { x: MARGIN_X, y, size: 19, font: fonts.bold, color: TEXT });
    y -= 16;
    y = drawParagraph(page4, `Issued by ${property.sro_name || 'the registering authority'}${property.sro_code ? ` (${property.sro_code})` : ''}. Reproduced as received.`, {
      x: MARGIN_X,
      y,
      size: 9,
      font: fonts.regular,
      color: INK_SOFT,
      maxWidth: contentWidth,
      lineHeight: 12,
    });
    y -= 10;

    // Fixed bottom boundary leaves room for the disclaimer + footer below.
    const boxBottom = 130;
    const boxTop = y;
    const boxH = boxTop - boxBottom;
    const boxW = contentWidth;

    let ecEmbedded = false;
    let pdfPagesToAppend: PDFPage[] | null = null;
    if (data.ec?.url) {
      const fetched = await fetchBytes(data.ec.url);
      if (fetched) {
        const isPdf = fetched.contentType.includes('pdf') || (fetched.bytes[0] === 0x25 && fetched.bytes[1] === 0x50 && fetched.bytes[2] === 0x44 && fetched.bytes[3] === 0x46);
        if (isPdf) {
          try {
            const ecDoc = await PDFDocument.load(fetched.bytes, { ignoreEncryption: true });
            pdfPagesToAppend = await pdfDoc.copyPages(ecDoc, ecDoc.getPageIndices());
            ecEmbedded = pdfPagesToAppend.length > 0;
          } catch {
            ecEmbedded = false;
          }
          if (ecEmbedded) {
            page4.drawRectangle({ x: MARGIN_X, y: boxBottom, width: boxW, height: boxH, color: SURFACE });
            drawParagraph(page4, 'Supplied as a PDF — reproduced in full, exactly as received, as the page(s) immediately following this one.', {
              x: MARGIN_X + 20,
              y: boxBottom + boxH - 26,
              size: 10,
              font: fonts.regular,
              color: TEXT,
              maxWidth: boxW - 40,
              lineHeight: 14,
            });
          }
        } else {
          const img = await embedImageBytes(pdfDoc, fetched.bytes, fetched.contentType);
          if (img) {
            page4.drawRectangle({ x: MARGIN_X, y: boxBottom, width: boxW, height: boxH, borderWidth: 1.4, borderColor: DIVIDER, color: WHITE });
            const scale = Math.min((boxW - 16) / img.width, (boxH - 16) / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            page4.drawImage(img, { x: MARGIN_X + (boxW - drawW) / 2, y: boxBottom + (boxH - drawH) / 2, width: drawW, height: drawH });
            ecEmbedded = true;
          }
        }
      }
    }

    if (!ecEmbedded) {
      // This block only runs when ecRequested is true (page 4 only exists
      // then), so the file is either not uploaded yet or failed to embed —
      // either way, "still being processed" is the honest, non-alarming
      // message; a genuine embed failure surfaces to admins separately
      // via the property's own document record, not by scaring the owner.
      page4.drawRectangle({ x: MARGIN_X, y: boxBottom, width: boxW, height: boxH, color: SURFACE });
      drawParagraph(
        page4,
        'This encumbrance certificate is still being processed and will appear here once received. Photographs and the on-site checks above are unaffected.',
        { x: MARGIN_X + 20, y: boxBottom + boxH - 30, size: 10, font: fonts.regular, color: INK_SOFT, maxWidth: boxW - 40, lineHeight: 14 }
      );
    }

    // scope & disclaimer
    const discTop = 112;
    drawRule(page4, MARGIN_X, PAGE_W - MARGIN_X, discTop, 1.4, DIVIDER);
    drawLabel(page4, 'Scope and disclaimer', MARGIN_X, discTop - 14, fonts.regular);
    const disclaimer =
      'Plot360 is not a real estate broker, agent, valuer, surveyor or title-verification authority. This report records what a Plot360 field agent observed on the ground on the date stated, and reproduces the encumbrance certificate as issued; it does not verify ownership, title, encumbrances or the legal status of the property beyond the authorisation documents collected from the customer, and it is not legal advice. Photographs and videos are unedited and timestamped at capture. For an opinion on title or on the entries in the certificate, consult an advocate. Full terms at plot360.in/legal/terms-of-use.';
    drawParagraph(page4, disclaimer, { x: MARGIN_X, y: discTop - 28, size: 7.5, font: fonts.regular, color: INK_SOFT, maxWidth: contentWidth, lineHeight: 10.5 });

    drawFooter(page4, fonts, 'Questions? WhatsApp +91 90000 36000 · plot360.in', 4, 4);

    // Raw appended EC PDF pages (only when the EC was itself a PDF)
    // intentionally carry no Plot360 chrome/footer — they're the
    // customer's own document, reproduced exactly as received, not
    // re-numbered as part of our 4 pages.
    if (pdfPagesToAppend) pdfPagesToAppend.forEach((p) => pdfDoc.addPage(p));
  }

  return pdfDoc.save();
}
