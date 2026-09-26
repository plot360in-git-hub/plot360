export type VisitQuestionType = 'boolean' | 'text';

export interface VisitQuestion {
  key: string;
  label: string;
  type: VisitQuestionType;
  placeholder?: string;
}

// Fixed set of 10 — deliberately mostly Yes/No for fast mobile answering
// in the field, with two short-answer questions for anything the fixed
// checks don't capture. Shared between both agent submission flows
// (authenticated /agent/jobs and the public magic-link page) and the
// customer-facing visit report, so the questions/order never drift apart.
export const VISIT_QUESTIONS: VisitQuestion[] = [
  { key: 'q_boundary_intact', label: 'Is the plot boundary/fencing intact?', type: 'boolean' },
  { key: 'q_encroachment', label: 'Any signs of encroachment on the plot?', type: 'boolean' },
  { key: 'q_illegal_dumping', label: 'Any illegal dumping or debris on the plot?', type: 'boolean' },
  { key: 'q_vacant_as_expected', label: 'Is the plot vacant, as expected?', type: 'boolean' },
  { key: 'q_unauthorized_construction', label: 'Any unauthorized construction or activity on the plot?', type: 'boolean' },
  { key: 'q_boundary_markers_visible', label: 'Are boundary markers/pillars visible and intact?', type: 'boolean' },
  { key: 'q_govt_notice_posted', label: 'Any visible government/municipal notice posted on site?', type: 'boolean' },
  { key: 'q_water_logging', label: 'Water logging or drainage issue observed?', type: 'boolean' },
  { key: 'q_overall_condition', label: 'Overall plot condition', type: 'text', placeholder: 'e.g. Clean, overgrown grass only' },
  { key: 'q_attention_needed', label: "Anything needing the owner's attention?", type: 'text', placeholder: 'e.g. None' },
];

// Which answers are the ones worth flagging — shared by the admin
// Submission review screen (highlighting) and the visit report PDF
// (verdict count, accent-coloured rows), so the two never classify the
// same answer differently. A boolean question is concerning either when
// it's true (encroachment, dumping, etc.) or when it's false (boundary
// intact/vacant/markers-visible — concerning when NOT met).
export const CONCERNING_WHEN_FALSE = new Set(['q_boundary_intact', 'q_vacant_as_expected', 'q_boundary_markers_visible']);
export const CONCERNING_WHEN_TRUE = new Set(['q_encroachment', 'q_illegal_dumping', 'q_unauthorized_construction', 'q_govt_notice_posted', 'q_water_logging']);

export function isConcerningAnswer(key: string, value: string | boolean | null | undefined) {
  if (typeof value === 'boolean') {
    return (value && CONCERNING_WHEN_TRUE.has(key)) || (!value && CONCERNING_WHEN_FALSE.has(key));
  }
  // The two text questions: only q_attention_needed is ever "concerning",
  // and only when the agent actually wrote something (not blank/"none").
  if (key === 'q_attention_needed') {
    const v = (value ?? '').toString().trim().toLowerCase();
    return v.length > 0 && v !== 'none' && v !== 'no' && v !== 'n/a' && v !== 'na';
  }
  return false;
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot asked for the admin's
// "Comments for the customer's report" field (monitoring_jobs.admin_remarks
// — shown to the customer as "Note from Plot360" / "Plot360 review
// comments") to arrive pre-filled with a professional, survey-report-style
// summary composed from the agent's own answers, instead of starting
// blank and needing the admin to type one from scratch every time. This is
// deliberately a different, more narrative composition than
// lib/pdf/visitReportPdf.ts's own composeSummary() (which drives the
// PDF's separate, always-auto "Summary" box on page 1 and is never shown
// for editing) — this one is only ever a starting DRAFT: the admin sees it
// in an editable textarea (SubmissionReviewActions.tsx) and can rewrite or
// clear it entirely before approving, same as if they'd typed it
// themselves.
export function composeVisitSummaryDraft(job: Record<string, any>, propertyName: string): string {
  const name = propertyName || 'the property';
  const vacant = !!job.q_vacant_as_expected;
  const boundaryIntact = !!job.q_boundary_intact;
  const markersVisible = !!job.q_boundary_markers_visible;

  const sentences: string[] = [
    `Our field agent visited ${name} and carried out a full on-site inspection.`,
    `The plot was found ${vacant ? 'vacant, as expected' : 'not vacant, contrary to what was expected'}, with the boundary/fencing ${boundaryIntact ? 'intact' : 'not fully intact'} and boundary markers/pillars ${markersVisible ? 'visible and intact' : 'not fully visible'}.`,
  ];

  const concerns: string[] = [];
  if (job.q_encroachment) concerns.push('signs of encroachment');
  if (job.q_illegal_dumping) concerns.push('illegal dumping or debris');
  if (job.q_unauthorized_construction) concerns.push('unauthorized construction or activity');
  if (job.q_govt_notice_posted) concerns.push('a government/municipal notice posted on site');
  if (job.q_water_logging) concerns.push('a water-logging or drainage issue');
  sentences.push(
    concerns.length
      ? `The visit noted ${concerns.join(', ')}.`
      : 'No encroachment, unauthorized construction, illegal dumping, or government notice was observed, and no water-logging or drainage issues were noted.'
  );

  const overallCondition = String(job.q_overall_condition || '').trim();
  if (overallCondition) sentences.push(`Overall plot condition: ${overallCondition}.`);

  const attention = String(job.q_attention_needed || '').trim();
  const attentionMeaningful = attention.length > 0 && !['none', 'no', 'n/a', 'na'].includes(attention.toLowerCase());
  if (attentionMeaningful) sentences.push(`For the owner's attention: ${attention}.`);

  const notes = String(job.observations || '').trim();
  if (notes) sentences.push(`Additional notes from the field agent: ${notes}`);

  return sentences.join(' ');
}

// Extracts and validates the 10 answers from a submitted FormData. Used by
// both agent submission actions (authenticated + magic-link) so the same
// validation rules apply regardless of which path an agent used.
export function extractVisitAnswers(formData: FormData): { error: string } | { values: Record<string, string | boolean> } {
  const values: Record<string, string | boolean> = {};
  for (const q of VISIT_QUESTIONS) {
    const raw = String(formData.get(q.key) || '').trim();
    if (q.type === 'boolean') {
      if (raw !== 'yes' && raw !== 'no') return { error: `Please answer: ${q.label}` };
      values[q.key] = raw === 'yes';
    } else {
      if (!raw) return { error: `Please answer: ${q.label}` };
      values[q.key] = raw;
    }
  }
  return { values };
}
