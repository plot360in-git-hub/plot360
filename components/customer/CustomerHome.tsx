'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WA_LINK, TEL_LINK, DISPLAY_PHONE } from '@/lib/contact';
import { totalRemainingCredits, isExpiringSoon, nearestExpiry, daysUntil, milestoneStage, MILESTONES } from '@/lib/visitCredits';
import { logOut } from '@/components/auth/auth.actions';
import type { VisitCredit } from '@/types/database.types';

type PropertyRow = {
  id: string;
  property_name: string;
  status: 'pending' | 'verified' | 'rejected';
  registration_date: string | null;
  street_address: string | null;
  rejection_reason: string | null;
};

type JobRow = { id: string; status: string; visit_number: number | null; decided_at?: string | null };

function formatChipDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Redesign 2026-09 (follow-up) — design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html", "New user — empty" screen.
const HOW_IT_WORKS = [
  { n: '01', title: 'Name your property', body: 'One field. Location and size are optional.' },
  { n: '02', title: 'Choose visits and pay', body: 'One visit, or four usable within a year.' },
  { n: '03', title: 'A representative takes over', body: 'Documents and owner approval, over WhatsApp.' },
  { n: '04', title: 'Report lands here', body: 'Photos, video and a downloadable PDF.' },
];

// Redesign 2026-09 (follow-up, round 6) — Plot flagged the expanded
// property card on Home: clicking a completed visit's chip should open
// that visit's own report, and the card was missing any way to reach a
// report at all. Chips now carry the underlying job (state + id) instead
// of just a display label, so a "Done" chip can link straight to
// `/properties/[id]/visit-report/[jobId]` — a real interaction the mock
// itself doesn't have (its chips are static, non-clickable demo data;
// design_handoff_plot360_redesign, "Plot360 Customer.dc.html", visits()),
// but Plot asked for it directly and it maps naturally onto data we
// already have per visit.
type VisitChip = { state: 'Done' | 'Set' | 'Unused'; jobId: string | null; doneAt: string | null };

function visitChips(totalPurchased: number, jobs: JobRow[]): VisitChip[] {
  const count = Math.min(Math.max(totalPurchased, 0), 8);
  const chips: VisitChip[] = [];
  for (let i = 1; i <= count; i++) {
    const job = jobs.find((j) => j.visit_number === i);
    if (job && ['approved', 'ec_pending'].includes(job.status)) chips.push({ state: 'Done', jobId: job.id, doneAt: job.decided_at ?? null });
    else if (job && ['assigned', 'accepted', 'submitted', 'rejected'].includes(job.status)) chips.push({ state: 'Set', jobId: null, doneAt: null });
    else chips.push({ state: 'Unused', jobId: null, doneAt: null });
  }
  return chips;
}

// The mock's expanded card leads with a one-line status ("Visit 2 report
// ready", "Representative collecting documents" — same file, `props`
// array) above the visit chips; this reads it off the real job/property
// state instead of the mock's fixed demo strings. Report-ready takes
// priority since it's the most actionable state (something new to look
// at), same as the mock's own example properties.
function propertyStatusLine(p: PropertyRow, jobs: JobRow[]): string | null {
  if (p.status === 'rejected') return null; // rejection_reason is already shown separately
  const reportJobs = jobs.filter((j) => j.visit_number && ['approved', 'ec_pending'].includes(j.status));
  if (reportJobs.length > 0) {
    const latest = reportJobs.reduce((a, b) => ((b.visit_number ?? 0) > (a.visit_number ?? 0) ? b : a));
    return `Visit ${latest.visit_number} report ready`;
  }
  const inProgress = jobs.find((j) => j.visit_number && ['assigned', 'accepted'].includes(j.status));
  if (inProgress) return `Visit ${inProgress.visit_number} scheduled`;
  const underReview = jobs.find((j) => j.visit_number && j.status === 'submitted');
  if (underReview) return `Visit ${underReview.visit_number} under review`;
  if (p.status === 'pending') return 'Representative collecting documents';
  return null;
}

export function CustomerHome({
  firstName,
  maskedPhone,
  properties,
  creditsByProperty,
  reservedByProperty,
  jobsByProperty,
}: {
  firstName: string;
  maskedPhone: string | null;
  properties: PropertyRow[];
  creditsByProperty: Record<string, VisitCredit[]>;
  reservedByProperty: Record<string, number>;
  jobsByProperty: Record<string, JobRow[]>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const allCredits = Object.values(creditsByProperty).flat();
  const totalCredits = totalRemainingCredits(allCredits);
  const expiry = nearestExpiry(allCredits);
  const expiringSoon = isExpiringSoon(allCredits);

  const schedulableProperty = properties.find(
    (p) => p.status === 'verified' && totalRemainingCredits(creditsByProperty[p.id] ?? []) > (reservedByProperty[p.id] ?? 0)
  );

  // Redesign 2026-09 (follow-up, round 2) — Plot reported "no schedule
  // visit option" on a test account. Root cause: this used to be a single
  // conditional slot that showed EITHER "Schedule a visit" OR "Register a
  // property", never both — so an account with properties but none
  // currently schedulable (all pending/rejected, or credits used up) saw
  // neither the real CTA nor a way to add another property. The mock
  // (design_handoff_plot360_redesign, "Plot360 Customer.dc.html", "home"
  // screen) always shows BOTH, as two separate always-visible elements: a
  // full-width "Register a property →" button inside the poster, and a
  // separate "Schedule a visit | WhatsApp us | Call" row below it. Rebuilt
  // to match that exactly. "Schedule a visit" now always links somewhere
  // useful instead of only existing when schedulableProperty is set:
  // straight to booking when a property is ready, otherwise to that
  // property's own page (to see status / buy more credits) if the
  // customer has any property at all, otherwise to registration.
  const scheduleHref = schedulableProperty
    ? `/properties/${schedulableProperty.id}/schedule`
    : properties.length > 0
      ? `/properties/${properties[0].id}`
      : '/properties/new';

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      {/* Hero card — design_handoff_plot360_redesign, "Plot360
          Customer.dc.html", "home" screen, reworked into a rounded
          pastel-gradient card (Redesign 2026-09, follow-up round 7 —
          Plot asked to move off the flat red/orange "Modernist" look
          toward the soft gradient card style on facebook.com/developers).
          This is a deliberate, flagged departure from the literal mock
          in two ways: (1) the mock's edge-to-edge solid-red band is now
          an inset, rounded card on the plain page background, and (2)
          the Schedule/WhatsApp/Call row — a separate full-bleed element
          below the poster in the mock — is folded into the bottom of
          this same card as three soft pill buttons, since a hard-
          divided, edge-to-edge row doesn't sit inside a rounded card the
          way it sat between two flat bands. Everything inside switches
          from white-on-solid-color text to dark-on-pale-gradient (see
          each element below) to stay readable against the new
          background. The top row (PLOT360 wordmark + identity) is still
          the only nav-like element here — see the note on Log out
          further down for why it's still there. */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--gradient-hero)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 22px 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>
                PLOT<span style={{ color: 'var(--color-accent-700)' }}>360</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                <Link href="/profile/edit" style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                  {firstName || 'there'}
                  {maskedPhone ? ` · ${maskedPhone}` : ''}
                </Link>
                {/* Redesign 2026-09 (follow-up, round 2) — the mock draws
                    no account actions anywhere on this screen; this and
                    the identity link above exist only because
                    CustomerHeader (which used to carry Log out) no
                    longer wraps /dashboard — see app/dashboard/layout.tsx. */}
                <form action={logOut}>
                  <button
                    type="submit"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      color: 'var(--p-ink-soft)',
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Log out
                  </button>
                </form>
              </div>
            </div>

            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 56, lineHeight: 0.92, letterSpacing: '-.04em', marginTop: 24 }}>
              {totalCredits}
            </div>
            <div style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4, color: 'var(--p-ink-soft)' }}>
              Site visits in credit
            </div>
            {expiringSoon && expiry && (
              <p
                style={{
                  fontSize: 12.5,
                  background: 'rgba(255,255,255,.6)',
                  color: 'var(--color-accent-700)',
                  fontWeight: 600,
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 999,
                  marginTop: 10,
                }}
              >
                Expiring in {daysUntil(expiry)} days
              </p>
            )}

            <div style={{ height: 1, background: 'rgba(32,30,29,.14)', margin: '16px 0 14px' }} />
            <p style={{ fontSize: 13, lineHeight: 1.5, maxWidth: '23em', color: 'var(--p-ink-soft)' }}>
              Your land is checked on the ground by a Plot360 agent. You send a name and a payment; a representative
              does the rest on WhatsApp.
            </p>

            <Link
              href="/properties/new"
              className="btn btn-primary btn-block"
              style={{ minHeight: 48, fontSize: 14, marginTop: 16, textDecoration: 'none', justifyContent: 'center' }}
            >
              Register a property →
            </Link>

            {/* Redesign 2026-09 (follow-up, round 7) — folded in from the
                mock's separate full-bleed "Schedule a visit | WhatsApp us
                | Call" row (see round-5 comment history for why that used
                to be its own maxWidth:640 block below the poster) — now
                three soft pill buttons inside the card instead, since the
                card is rounded and no longer edge-to-edge. Destinations
                unchanged (see scheduleHref above). */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Link
                href={scheduleHref}
                className="btn"
                style={{ flex: '1 1 140px', background: 'rgba(255,255,255,.55)', color: 'var(--color-text)', textDecoration: 'none' }}
              >
                Schedule a visit
              </Link>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ flex: '1 1 140px', background: 'rgba(255,255,255,.55)', color: 'var(--color-text)', gap: 8, textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
                </svg>
                WhatsApp us
              </a>
              <a
                href={TEL_LINK}
                className="btn btn-icon"
                style={{ flex: 'none', width: 48, background: 'rgba(255,255,255,.55)', color: 'var(--color-accent-700)' }}
                aria-label="Call Plot360"
                title={DISPLAY_PHONE}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Properties under watch */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Redesign 2026-09 (follow-up) — the mock's "Properties under
            watch" header just shows a count next to the heading (no "+ Add
            property" link — that's what the poster header's "Register a
            property" button above is for); the extra link here didn't
            match and was removed.
            Redesign 2026-09 (follow-up, round 5) — this heading was an
            <h2>, which this codebase's global styles render large and
            bold; the mock (design/Plot360 Customer.dc.html, lines ~141-
            144) draws it as a small 10px uppercase label, the same size/
            weight/color as the count next to it — not a heading at all,
            just two matching eyebrow-style labels sharing a row. Restyled
            to match exactly instead of looking like a bolded section
            title next to an unrelated small number. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>
            Properties under watch
          </div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, color: 'var(--p-ink-soft)' }}>
            {properties.length}
          </div>
        </div>

        {properties.length === 0 && (
          // Redesign 2026-09 (follow-up) — the design's own zero-properties
          // screen ("New user — empty") is this "How it works" list, not
          // just a one-line message; this was missed in the original
          // customer app phase along with the auth screens (see
          // components/auth/AuthScreen.tsx). Content matches the mock.
          <div>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginBottom: 4 }}>
              How it works
            </p>
            {HOW_IT_WORKS.map((h) => (
              <div key={h.n} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--color-divider)' }}>
                <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'var(--color-accent-700)', flex: 'none', paddingTop: 2 }}>
                  {h.n}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14.5 }}>{h.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--p-ink-soft)', lineHeight: 1.45, marginTop: 3 }}>{h.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {properties.map((p) => {
            const credits = creditsByProperty[p.id] ?? [];
            const jobs = jobsByProperty[p.id] ?? [];
            const reserved = reservedByProperty[p.id] ?? 0;
            const remaining = Math.max(totalRemainingCredits(credits) - reserved, 0);
            const totalPurchased = credits.reduce((sum, c) => sum + c.quantity_purchased, 0);
            const stage = milestoneStage(p, jobs, reserved > 0);
            const isOpen = expanded === p.id;

            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 16,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 92, height: 68, background: 'var(--color-surface)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 15.5, marginBottom: 4 }}>{p.property_name}</h3>
                      <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginBottom: 10 }}>
                        {p.street_address || 'No address yet'}
                      </p>
                      {/* Redesign 2026-09 (follow-up, round 6) — the mock
                          (design/Plot360 Customer.dc.html, lines ~157-163)
                          labels each of the 4 track segments individually
                          ("Registered / Verified / Visit set / Report",
                          all shown at once) rather than one caption below
                          the whole bar for just the current stage — fixed
                          to match, since Plot's own screenshot of this
                          exact row shows all four. */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {MILESTONES.map((m, i) => (
                          <div key={m} style={{ flex: 1 }}>
                            <div
                              title={m}
                              style={{
                                height: 4,
                                background: i < stage ? 'var(--color-accent)' : 'var(--color-divider)',
                              }}
                            />
                            <div
                              style={{
                                fontSize: 8,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginTop: 4,
                                lineHeight: 1.2,
                                color: i < stage ? 'var(--color-text)' : 'var(--p-ink-muted)',
                              }}
                            >
                              {m}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (() => {
                  const statusLine = propertyStatusLine(p, jobs);
                  // Redesign 2026-09 (follow-up, round 6) — reused below
                  // for the primary "Open visit N report" button, so it's
                  // computed once alongside the status line rather than
                  // twice.
                  const reportJobs = jobs.filter((j) => j.visit_number && ['approved', 'ec_pending'].includes(j.status));
                  const latestReport =
                    reportJobs.length > 0
                      ? reportJobs.reduce((a, b) => ((b.visit_number ?? 0) > (a.visit_number ?? 0) ? b : a))
                      : null;

                  return (
                    <div style={{ background: 'var(--color-neutral-900)', color: 'var(--color-bg)', padding: 16 }}>
                      {p.status === 'rejected' && p.rejection_reason ? (
                        <p style={{ fontSize: 12.5, marginBottom: 12, color: '#ffb3a3' }}>{p.rejection_reason}</p>
                      ) : (
                        statusLine && (
                          <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.65, marginBottom: 10 }}>
                            {statusLine}
                          </p>
                        )
                      )}
                      {totalPurchased > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                          {visitChips(totalPurchased, jobs).map((chip, i) =>
                            chip.state === 'Done' && chip.jobId ? (
                              <Link
                                key={i}
                                href={`/properties/${p.id}/visit-report/${chip.jobId}`}
                                className="tag"
                                style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', textDecoration: 'none' }}
                              >
                                Visit {i + 1} · Done{chip.doneAt ? ` · ${formatChipDate(chip.doneAt)}` : ''}
                              </Link>
                            ) : (
                              <span
                                key={i}
                                className="tag"
                                style={{
                                  background: chip.state === 'Set' ? 'var(--p-on-dark-rule)' : 'transparent',
                                  border: chip.state === 'Unused' ? '1px solid var(--p-on-dark-rule)' : 'none',
                                  color: 'var(--color-bg)',
                                }}
                              >
                                Visit {i + 1} · {chip.state}
                              </span>
                            )
                          )}
                        </div>
                      )}
                      <p style={{ fontSize: 13, marginBottom: 14 }}>{remaining} of {totalPurchased} visit credits left</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {latestReport && (
                          <Link
                            href={`/properties/${p.id}/visit-report/${latestReport.id}`}
                            className="btn btn-primary btn-block"
                            style={{ textDecoration: 'none' }}
                          >
                            Open visit {latestReport.visit_number} report
                          </Link>
                        )}
                        {p.status === 'verified' && remaining > 0 && (
                          <Link href={`/properties/${p.id}/schedule`} className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
                            Schedule the next visit
                          </Link>
                        )}
                        {remaining === 0 && (
                          <Link href={`/properties/${p.id}/plan`} className="btn btn-primary btn-block" style={{ textDecoration: 'none' }}>
                            Buy more visit credits
                          </Link>
                        )}
                        <Link href={`/properties/${p.id}`} className="btn btn-secondary btn-block" style={{ textDecoration: 'none', borderColor: 'var(--p-on-dark-rule)', color: 'var(--color-bg)' }}>
                          Property visit history
                        </Link>
                        <Link href="/service-requests/new" className="btn-ghost btn" style={{ color: 'var(--color-bg)' }}>
                          Raise a service request
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
