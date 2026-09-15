'use client';

import { useMemo, useState, useTransition } from 'react';
import { requestVisit } from '@/components/payments/visitCredits.actions';
import { ConfirmationScreen, type ConfirmationVariant } from './ConfirmationScreen';
import { isSelectable, endDate, toDateOnly, formatWindow } from '@/lib/scheduling';

const WINDOW_LENGTHS = [3, 5, 7] as const;

// Redesign 2026-09 — "Schedule a visit" (design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html"). The design's own prototype hardcoded a
// September 2026 example month for its calendar math; lib/scheduling.ts
// generalizes the same weekday/lead-time rules to the real current date.
// Shows the next 28 days as pickable start dates rather than a full
// month grid, since a visit window can span a month boundary.
export function ScheduleVisit({
  propertyId,
  propertyName,
  eligible,
  hasCredits,
  reason,
  creditsRemaining,
  expiresAt,
  maskedPhone,
}: {
  propertyId: string;
  propertyName: string;
  eligible: boolean;
  hasCredits: boolean;
  reason?: string;
  creditsRemaining: number;
  expiresAt: string | null;
  maskedPhone?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [windowLength, setWindowLength] = useState<3 | 5 | 7>(3);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationVariant | null>(null);

  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, [today]);

  const end = startDate ? endDate(startDate, windowLength) : null;

  function confirm() {
    if (!startDate || !end) return;
    setError(null);
    startTransition(async () => {
      const result = await requestVisit(propertyId, toDateOnly(startDate), toDateOnly(end));
      if ('error' in result) setError(result.error);
      else {
        setConfirmation({
          kind: 'sched',
          propertyName: result.propertyName,
          windowText: formatWindow(startDate, end),
          creditsRemaining: result.remainingAfter,
          expiresAt: expiresAt ?? toDateOnly(startDate),
        });
      }
    });
  }

  // Redesign 2026-09 (follow-up, round 2) — this used to send "Back to my
  // properties" to this property's own page rather than the properties
  // list. The mock's "done" screen always uses the same `goHome` handler
  // regardless of which flow led here (registration, scheduling, ...) —
  // it always returns to the Home/"my properties" screen, never to a
  // single property's detail page. Dropped the override so it uses
  // ConfirmationScreen's own '/dashboard' default, matching that.
  if (confirmation) return <ConfirmationScreen variant={confirmation} maskedPhone={maskedPhone} />;

  if (!eligible) {
    return (
      <div className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>Not ready to schedule yet</h1>
          <p style={{ fontSize: 14, color: 'var(--p-ink-soft)' }}>{reason ?? 'This property is not eligible for scheduling yet.'}</p>
        </div>
      </div>
    );
  }

  if (!hasCredits) {
    return (
      <div className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 10 }}>No visit credits left</h1>
          <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 20 }}>
            Buy more visit credits on {propertyName} to schedule your next visit.
          </p>
          <a href={`/properties/${propertyId}/plan`} className="btn btn-primary">
            Buy visit credits
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p360" style={{ minHeight: '70vh', padding: '32px 20px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Schedule a visit</h1>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 24 }}>
          For <strong>{propertyName}</strong> — {creditsRemaining} visit credit{creditsRemaining === 1 ? '' : 's'} available.
        </p>

        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Earliest start date</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 24 }}>
          {days.map((d) => {
            const selectable = isSelectable(d, today);
            const selected = startDate && toDateOnly(startDate) === toDateOnly(d);
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={!selectable}
                onClick={() => setStartDate(d)}
                style={{
                  padding: '8px 0',
                  fontSize: 12.5,
                  border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                  background: selectable ? 'var(--color-surface)' : 'transparent',
                  color: selectable ? 'var(--color-text)' : 'var(--p-ink-muted)',
                  cursor: selectable ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </button>
            );
          })}
        </div>

        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Visit window</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {WINDOW_LENGTHS.map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => setWindowLength(len)}
              className="btn"
              style={{
                flex: 1,
                justifyContent: 'center',
                border: windowLength === len ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
              }}
            >
              {len} days
            </button>
          ))}
        </div>

        {startDate && end && (
          <p style={{ fontSize: 13.5, marginBottom: 20 }}>
            We’ll aim to visit between <strong>{formatWindow(startDate, end)}</strong>.
          </p>
        )}

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="button" disabled={!startDate || isPending} onClick={confirm}>
          {isPending ? 'Scheduling…' : 'Confirm visit'}
        </button>
      </div>
    </div>
  );
}
