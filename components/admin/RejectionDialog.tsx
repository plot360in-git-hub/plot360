'use client';

import { useState, useTransition } from 'react';

// Redesign 2026-09 — admin console. One shared, context-specific dialog
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html" — REJECT
// config object) reused for all four contexts: property verification
// reject, submission reject-and-reassign, agent "request missing
// documents", and payment mismatch. The parent passes the reason list,
// recipient label and message template; this component only owns the
// open/reason/free-text UI state and the live message preview.
export function RejectionDialog({
  triggerLabel,
  triggerClassName = 'btn btn-secondary',
  title,
  note,
  reasons,
  recipientLabel,
  placeholder,
  cta,
  messagePrefix,
  messageSuffix,
  onSubmit,
}: {
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  note: string;
  reasons: string[];
  recipientLabel: string;
  placeholder: string;
  cta: string;
  messagePrefix: string;
  messageSuffix: string;
  onSubmit: (reasonText: string) => Promise<{ error?: string } | { success: boolean } | void>;
}) {
  const [open, setOpen] = useState(false);
  const [reasonIndex, setReasonIndex] = useState(0);
  const [freeText, setFreeText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reasonLabel = reasons[reasonIndex] ?? reasons[0] ?? '';
  const combinedReason = freeText.trim() ? `${reasonLabel} — ${freeText.trim()}` : reasonLabel;
  const preview = `${messagePrefix}${reasonLabel}.${messageSuffix}`;

  return (
    <>
      <button type="button" className={triggerClassName} style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }} onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(32,30,29,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--color-bg)', borderTop: '3px solid var(--color-accent)', padding: '22px 24px 24px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 6 }}>{note}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 14 }}>
              {reasons.map((r, i) => (
                <label
                  key={r}
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.4, padding: '9px 0', borderBottom: '1px solid var(--color-divider)', cursor: 'pointer' }}
                >
                  <input type="radio" name="reject-reason" checked={reasonIndex === i} onChange={() => setReasonIndex(i)} style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 16, height: 16 }} />
                  <span>{r}</span>
                </label>
              ))}
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Anything to add (optional)</label>
              <textarea className="input" style={{ minHeight: 74, resize: 'none', lineHeight: 1.5 }} placeholder={placeholder} value={freeText} onChange={(e) => setFreeText(e.target.value)} />
            </div>

            <div style={{ background: 'var(--color-surface)', padding: '12px 13px', borderLeft: '3px solid var(--color-accent)', marginTop: 14 }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-soft)' }}>{recipientLabel}</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{preview}</div>
            </div>

            {error && <p style={{ fontSize: 12.5, color: 'var(--p-alert)', marginTop: 10 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 42, fontSize: 13, padding: '0 16px' }}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await onSubmit(combinedReason);
                    if (result && 'error' in result && result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                  })
                }
              >
                {pending ? 'Sending…' : cta}
              </button>
              <button type="button" className="btn btn-secondary" style={{ minHeight: 42, fontSize: 13, padding: '0 16px' }} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
