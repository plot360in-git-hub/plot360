'use client';

import { useState, useTransition } from 'react';
import { extendVisitCredits } from '@/components/payments/visitCredits.actions';

// Redesign 2026-09 — admin console, Property verification detail's
// "Visit credits" panel: +30/+60/+90 days with a reason. "One extension
// per property" — the parent disables this entirely once extended.
export function ExtendCreditsForm({ propertyId, disabled }: { propertyId: string; disabled: boolean }) {
  const [days, setDays] = useState<30 | 60 | 90 | null>(null);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (disabled) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 32, fontSize: 11, padding: '0 10px', background: days === d ? 'var(--color-text)' : undefined, color: days === d ? 'var(--color-bg)' : undefined }}
            onClick={() => setDays(d as 30 | 60 | 90)}
          >
            +{d} days
          </button>
        ))}
      </div>
      <input className="input" style={{ minHeight: 34, marginTop: 8, fontSize: 11.5 }} placeholder="Reason for extension" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button
        type="button"
        className="btn btn-primary"
        style={{ minHeight: 32, fontSize: 11, marginTop: 8, padding: '0 12px' }}
        disabled={pending || !days || !reason.trim()}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await extendVisitCredits(propertyId, days!, reason);
            if ('error' in result) setMessage(result.error ?? null);
            else setMessage('Extended ✓');
          })
        }
      >
        {pending ? 'Saving…' : 'Extend'}
      </button>
      {message && <p style={{ fontSize: 10.5, color: message === 'Extended ✓' ? 'var(--p-ink-soft)' : 'var(--p-alert)', marginTop: 6 }}>{message}</p>}
      <div style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 7 }}>One extension per property. Customers ask on WhatsApp.</div>
    </div>
  );
}
