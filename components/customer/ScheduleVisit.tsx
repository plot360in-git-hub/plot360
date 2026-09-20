'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { requestVisit } from '@/components/payments/visitCredits.actions';
import { ConfirmationScreen, type ConfirmationVariant } from './ConfirmationScreen';
import { getSelectableWeeks, mondayOfWeekContaining, toDateOnly, formatWindow, type VisitWeek } from '@/lib/scheduling';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_COUNT = 4;

// Redesign 2026-09 (follow-up, round 27) — Plot: "remove the 3 days/5
// days/7 days button and directly give calendar ... allow to select a
// week — 1st week, 2nd week, 3rd week or 4th week — rather [than] a date
// range." The old flow picked one of the next 28 individual weekdays as a
// start date, then a 3/5/7-day window length on top of it
// (lib/scheduling.ts's old endDate()). This replaces both steps with an
// actual calendar grid: a muted "too soon" row for the current week, then
// four selectable Monday–Friday weeks, and picking any day in a week's row
// selects that whole week as the visit window. See getSelectableWeeks
// (lib/scheduling.ts) for why each option is always a full business week
// rather than a partial one.
//
// This only changes how the customer picks a start/end date — requestVisit
// below still receives a plain (windowStart, windowEnd) date pair exactly
// like before, so nothing downstream (visit_requests, the admin Job
// assignment queue's window display, the agent app, the visit-report PDF)
// needed any change; they all just read whatever two dates land in
// monitoring_jobs.requested_window_start/end.
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
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationVariant | null>(null);

  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(() => getSelectableWeeks(today, WEEK_COUNT), [today]);
  const selectedWeek: VisitWeek | null = selectedWeekIndex != null ? weeks[selectedWeekIndex] : null;

  // Calendar grid: a muted "too soon" row for today's own week, then one
  // row per selectable week — each row is the Monday..Sunday of that week
  // (weekends are shown for a real calendar look, greyed out, even though
  // only the Monday–Friday portion is ever the actual visit window).
  const gridStart = useMemo(() => mondayOfWeekContaining(today), [today]);
  const rows = useMemo(() => {
    const list: { days: Date[]; week: VisitWeek | null }[] = [];
    for (let r = 0; r < WEEK_COUNT + 1; r++) {
      const rowStart = new Date(gridStart);
      rowStart.setDate(rowStart.getDate() + r * 7);
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(rowStart);
        d.setDate(d.getDate() + i);
        days.push(d);
      }
      list.push({ days, week: r === 0 ? null : weeks[r - 1] });
    }
    return list;
  }, [gridStart, weeks]);

  function confirm() {
    if (!selectedWeek) return;
    setError(null);
    startTransition(async () => {
      const result = await requestVisit(propertyId, toDateOnly(selectedWeek.start), toDateOnly(selectedWeek.end));
      if ('error' in result) setError(result.error ?? null);
      else {
        setConfirmation({
          kind: 'sched',
          propertyName: result.propertyName,
          windowText: formatWindow(selectedWeek.start, selectedWeek.end),
          creditsRemaining: result.remainingAfter,
          expiresAt: expiresAt ?? toDateOnly(selectedWeek.start),
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

  // Redesign 2026-09 (follow-up, round 4) — Plot flagged the old
  // CustomerHeader still showing on this screen. It never had a back
  // button of its own, unlike RegisterQuick.tsx/PropertyVisitHistory.tsx/
  // ServiceRequestScreen.tsx, so it was quietly relying on
  // app/properties/layout.tsx's header for navigation. Added the same
  // back-button row those already use (design_handoff_plot360_redesign,
  // "Plot360 Customer.dc.html", "sched" screen: "← Schedule a site
  // visit"), and app/properties/layout.tsx no longer renders a header at
  // all — see that file.
  const backHeader = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
      <Link
        href="/dashboard"
        className="btn btn-secondary"
        style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }}
        aria-label="Back to dashboard"
      >
        ←
      </Link>
      <h1 style={{ fontSize: 17 }}>Schedule a site visit</h1>
    </div>
  );

  if (!eligible) {
    return (
      <div className="p360" style={{ minHeight: '80vh' }}>
        {backHeader}
        <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 380, textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>Not ready to schedule yet</h2>
            <p style={{ fontSize: 14, color: 'var(--p-ink-soft)' }}>{reason ?? 'This property is not eligible for scheduling yet.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasCredits) {
    return (
      <div className="p360" style={{ minHeight: '80vh' }}>
        {backHeader}
        <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 380, textAlign: 'center' }}>
            <h2 style={{ fontSize: 22, marginBottom: 10 }}>No visit credits left</h2>
            <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 20 }}>
              Buy more visit credits on {propertyName} to schedule your next visit.
            </p>
            <a href={`/properties/${propertyId}/plan`} className="btn btn-primary">
              Buy visit credits
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      {backHeader}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 20px 60px' }}>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 24 }}>
          For <strong>{propertyName}</strong> — {creditsRemaining} visit credit{creditsRemaining === 1 ? '' : 's'} available.
        </p>

        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Pick a week</h3>
        <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginBottom: 12 }}>
          An agent visits sometime in whichever week you choose — usually a weekday, though the
          full week including the weekend is held for them to complete it.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--p-ink-muted)' }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {rows.map((row, r) => {
            const isSelected = row.week && selectedWeek && row.week.start.getTime() === selectedWeek.start.getTime();
            const rowContent = (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, width: '100%' }}>
                {row.days.map((d) => {
                  // Redesign 2026-09 (follow-up, round 28) — weekend cells
                  // used to be styled muted like a disabled day, back when
                  // the saved window stopped at Friday and Sat/Sun weren't
                  // really part of it. Now the window runs through Sunday
                  // (see getSelectableWeeks), so within a selectable row
                  // weekends get the same normal styling as any other day
                  // — only the leading, not-yet-selectable "too soon" row
                  // still reads as muted/disabled.
                  const isToday = toDateOnly(d) === toDateOnly(today);
                  return (
                    <div
                      key={d.toISOString()}
                      style={{
                        textAlign: 'center',
                        padding: '9px 0',
                        fontSize: 12.5,
                        fontWeight: isToday ? 700 : 400,
                        color: !row.week ? 'var(--p-ink-muted)' : 'var(--color-text)',
                        textDecoration: isToday ? 'underline' : 'none',
                      }}
                    >
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
            );
            return (
              <div key={r}>
                {row.week && (
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--p-ink-soft)', marginBottom: 3 }}>
                    {row.week.label} · {formatWindow(row.week.start, row.week.end)}
                  </p>
                )}
                {row.week ? (
                  <button
                    type="button"
                    onClick={() => setSelectedWeekIndex(weeks.indexOf(row.week!))}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '4px 6px',
                      border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                      background: isSelected ? 'var(--color-accent-100)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div style={{ padding: '4px 6px', border: '1px solid var(--color-divider)', background: 'transparent', opacity: 0.55 }}>
                    {rowContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedWeek && (
          <p style={{ fontSize: 13.5, marginBottom: 20 }}>
            We’ll aim to visit between <strong>{formatWindow(selectedWeek.start, selectedWeek.end)}</strong>.
          </p>
        )}

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="button" disabled={!selectedWeek || isPending} onClick={confirm}>
          {isPending ? 'Scheduling…' : 'Confirm visit'}
        </button>
      </div>
    </div>
  );
}
