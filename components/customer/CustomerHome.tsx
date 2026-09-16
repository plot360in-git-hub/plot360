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

type JobRow = { id: string; status: string; visit_number: number | null };

// Redesign 2026-09 (follow-up) — design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html", "New user — empty" screen.
const HOW_IT_WORKS = [
  { n: '01', title: 'Name your property', body: 'One field. Location and size are optional.' },
  { n: '02', title: 'Choose visits and pay', body: 'One visit, or four usable within a year.' },
  { n: '03', title: 'A representative takes over', body: 'Documents and owner approval, over WhatsApp.' },
  { n: '04', title: 'Report lands here', body: 'Photos, video and a downloadable PDF.' },
];

function visitChips(totalPurchased: number, jobs: JobRow[]): Array<'Done' | 'Set' | 'Unused'> {
  const count = Math.min(Math.max(totalPurchased, 0), 8);
  const chips: Array<'Done' | 'Set' | 'Unused'> = [];
  for (let i = 1; i <= count; i++) {
    const job = jobs.find((j) => j.visit_number === i);
    if (job && ['approved', 'ec_pending'].includes(job.status)) chips.push('Done');
    else if (job && ['assigned', 'accepted', 'submitted', 'rejected'].includes(job.status)) chips.push('Set');
    else chips.push('Unused');
  }
  return chips;
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
      {/* Poster header — design_handoff_plot360_redesign, "Plot360
          Customer.dc.html", "home" screen. The top row (PLOT360 wordmark +
          identity) is the only nav-like element the mock has on this
          screen at all — there's no separate header bar. The identity
          text now links to /profile/edit, and a small "Log out" sits next
          to it: neither is in the literal mock (which draws no account
          actions anywhere), but with the persistent CustomerHeader removed
          from /dashboard (app/dashboard/layout.tsx), logging out needs
          *some* home — this is the least intrusive one, kept in the same
          small-caps style as the identity text it sits beside. */}
      <div style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', padding: '14px 20px 22px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>
              PLOT<span>360</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              <Link href="/profile/edit" style={{ color: 'var(--color-bg)', textDecoration: 'none' }}>
                {firstName || 'there'}
                {maskedPhone ? ` · ${maskedPhone}` : ''}
              </Link>
              <form action={logOut}>
                <button
                  type="submit"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-bg)',
                    opacity: 0.75,
                    fontSize: 10,
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
          <div style={{ fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>Site visits in credit</div>
          {expiringSoon && expiry && (
            <p style={{ fontSize: 12.5, background: 'rgba(0,0,0,0.15)', display: 'inline-block', padding: '3px 10px', marginTop: 10 }}>
              Expiring in {daysUntil(expiry)} days
            </p>
          )}

          <div style={{ height: 2, background: 'var(--color-bg)', opacity: 0.5, margin: '16px 0 14px' }} />
          <p style={{ fontSize: 13, lineHeight: 1.5, maxWidth: '23em' }}>
            Your land is checked on the ground by a Plot360 agent. You send a name and a payment; a representative
            does the rest on WhatsApp.
          </p>

          <Link
            href="/properties/new"
            className="btn btn-block"
            style={{ background: 'var(--color-bg)', color: 'var(--color-accent-700)', minHeight: 48, fontSize: 14, marginTop: 16, textDecoration: 'none' }}
          >
            Register a property →
          </Link>
        </div>
      </div>

      {/* Schedule / WhatsApp / Call toolbar — always visible, separate
          from "Register a property" above (see comment on scheduleHref).
          Redesign 2026-09 (follow-up, round 5) — on a wide (desktop)
          viewport this row used to run flush to the browser's edges while
          everything above and below it (the poster's own content, the
          "Register a property" button, "Properties under watch") sits in
          a centered 640px column — so it looked stretched and out of line
          with the button directly above it. Wrapped in the same
          maxWidth:640/margin:auto box as the rest of the page so its
          edges land exactly under "Register a property →"; on a phone-
          width screen this is a no-op (640px is wider than the viewport,
          same full-bleed look the mock draws). */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex' }}>
          <Link
            href={scheduleHref}
            className="btn"
            style={{
              flex: 1,
              justifyContent: 'flex-start',
              minHeight: 48,
              fontSize: 12.5,
              borderBottom: '2px solid var(--color-divider)',
              borderRight: '2px solid var(--color-divider)',
              textDecoration: 'none',
              color: 'var(--color-text)',
            }}
          >
            Schedule a visit
          </Link>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              flex: 1,
              justifyContent: 'flex-start',
              minHeight: 48,
              fontSize: 12.5,
              borderBottom: '2px solid var(--color-divider)',
              borderRight: '1px solid var(--color-divider)',
              gap: 8,
              color: 'var(--color-text)',
              textDecoration: 'none',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
            </svg>
            WhatsApp us
          </a>
          <a
            href={TEL_LINK}
            className="btn btn-icon"
            style={{ flex: 'none', width: 58, minHeight: 48, borderBottom: '2px solid var(--color-divider)', color: 'var(--color-accent)' }}
            aria-label="Call Plot360"
            title={DISPLAY_PHONE}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </a>
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
                      <div style={{ display: 'flex', gap: 4 }}>
                        {MILESTONES.map((m, i) => (
                          <div
                            key={m}
                            title={m}
                            style={{
                              flex: 1,
                              height: 4,
                              background: i < stage ? 'var(--color-accent)' : 'var(--color-divider)',
                            }}
                          />
                        ))}
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--p-ink-muted)', marginTop: 6 }}>{MILESTONES[stage - 1] ?? 'Registered'}</p>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ background: 'var(--color-neutral-900)', color: 'var(--color-bg)', padding: 16 }}>
                    {p.status === 'rejected' && p.rejection_reason && (
                      <p style={{ fontSize: 12.5, marginBottom: 12, color: '#ffb3a3' }}>{p.rejection_reason}</p>
                    )}
                    {totalPurchased > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                        {visitChips(totalPurchased, jobs).map((chip, i) => (
                          <span
                            key={i}
                            className="tag"
                            style={{
                              background:
                                chip === 'Done' ? 'var(--color-accent)' : chip === 'Set' ? 'var(--p-on-dark-rule)' : 'transparent',
                              border: chip === 'Unused' ? '1px solid var(--p-on-dark-rule)' : 'none',
                              color: 'var(--color-bg)',
                            }}
                          >
                            Visit {i + 1} · {chip}
                          </span>
                        ))}
                      </div>
                    )}
                    <p style={{ fontSize: 13, marginBottom: 14 }}>{remaining} of {totalPurchased} visit credits left</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
