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
