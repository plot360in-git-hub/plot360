'use client';

import { useState } from 'react';
import { VISIT_QUESTIONS } from '@/lib/visitReportQuestions';

// Renders the fixed 10-question set as fast-to-answer mobile inputs:
// tappable Yes/No button pairs for boolean questions, short text inputs
// for the two open-ended ones. Used identically by the authenticated
// agent job page and the public magic-link page, so both submission
// paths produce the same structured data for the customer's visit report.
export function VisitQuestionsFields({ defaultValues }: { defaultValues?: Record<string, any> }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of VISIT_QUESTIONS) {
      if (q.type === 'boolean' && defaultValues?.[q.key] !== null && defaultValues?.[q.key] !== undefined) {
        initial[q.key] = defaultValues[q.key] ? 'yes' : 'no';
      }
    }
    return initial;
  });

  return (
    <div style={{ marginBottom: 24 }}>
      {VISIT_QUESTIONS.map((q) => (
        <div key={q.key} style={{ marginBottom: 16 }}>
          <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>
            {q.label}<span style={{ color: 'var(--color-danger)' }}> *</span>
          </label>
          {q.type === 'boolean' ? (
            <>
              <input type="hidden" name={q.key} value={answers[q.key] ?? ''} />
              <div style={{ display: 'flex', gap: 8 }}>
                {(['yes', 'no'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAnswers((a) => ({ ...a, [q.key]: val }))}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 'var(--radius-button)',
                      border: answers[q.key] === val ? 'none' : '1px solid var(--color-border)',
                      background: answers[q.key] === val ? 'var(--color-accent)' : '#fff',
                      color: answers[q.key] === val ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <input
              className="field-input"
              name={q.key}
              required
              placeholder={q.placeholder}
              defaultValue={defaultValues?.[q.key] ?? ''}
            />
          )}
        </div>
      ))}
    </div>
  );
}
