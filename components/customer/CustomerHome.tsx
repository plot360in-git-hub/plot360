'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WA_LINK, TEL_LINK, DISPLAY_PHONE } from '@/lib/contact';
import { totalRemainingCredits, isExpiringSoon, nearestExpiry, daysUntil } from '@/lib/visitCredits';
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

// Milestone track: Registered (row exists) -> Verified (admin approved) ->
// Visit set (a visit has been requested/assigned) -> Report (at least one
// visit approved, so a report exists). Returns how many of the 4 are done.
function milestoneStage(property: PropertyRow, jobs: JobRow[], hasOpenRequest: boolean): number {
  if (property.status === 'rejected') return 1;
  let stage = 1; // registered
  if (property.status === 'verified') stage = 2;
  const hasActiveVisit = hasOpenRequest || jobs.some((j) => ['assigned', 'accepted', 'submitted'].includes(j.status));
  const hasReport = jobs.some((j) => ['approved', 'ec_pending'].includes(j.status));
  if (stage === 2 && (hasActiveVisit || hasReport)) stage = 3;
  if (stage === 3 && hasReport) stage = 4;
  return stage;
}

const MILESTONES = ['Registered', 'Verified', 'Visit set', 'Report'];

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

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      {/* Poster header */}
      <div style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', padding: '28px 20px 32px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 4 }}>Plot360</p>
          <h1 style={{ fontSize: 24, marginBottom: 2 }}>{firstName || 'there'}</h1>
          {maskedPhone && <p style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 20 }}>{maskedPhone}</p>}

          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{totalCredits}</div>
          <p style={{ fontSize: 13, opacity: 0.9, marginBottom: expiringSoon ? 6 : 20 }}>Site visits in credit</p>
          {expiringSoon && expiry && (
            <p style={{ fontSize: 12.5, background: 'rgba(0,0,0,0.15)', display: 'inline-block', padding: '3px 10px', marginBottom: 20 }}>
              Expiring in {daysUntil(expiry)} days
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {schedulableProperty ? (
              <Link
                href={`/properties/${schedulableProperty.id}/schedule`}
                className="btn"
                style={{ background: 'var(--color-bg)', color: 'var(--color-accent-700)', textDecoration: 'none' }}
              >
                Schedule a visit
              </Link>
            ) : (
              <Link
                href="/properties/new"
                className="btn"
                style={{ background: 'var(--color-bg)', color: 'var(--color-accent-700)', textDecoration: 'none' }}
              >
                Register a property
              </Link>
            )}
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ border: '1px solid var(--p-on-dark-rule)', color: 'var(--color-bg)' }}
            >
              WhatsApp us
            </a>
            <a href={TEL_LINK} className="btn" style={{ border: '1px solid var(--p-on-dark-rule)', color: 'var(--color-bg)' }} title={DISPLAY_PHONE}>
              Call
            </a>
          </div>
        </div>
      </div>

      {/* Properties under watch */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18 }}>Properties under watch</h2>
          <Link href="/properties/new" className="btn-ghost btn" style={{ fontSize: 13 }}>
            + Add property
          </Link>
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
