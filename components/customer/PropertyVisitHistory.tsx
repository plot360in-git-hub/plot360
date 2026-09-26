import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getVisitCreditsForProperty, getReservedCreditCounts } from '@/components/payments/visitCredits.actions';
import { totalRemainingCredits, nearestExpiry, canScheduleVisit, milestoneStage, MILESTONES } from '@/lib/visitCredits';
import { getMonitoringMediaDownloadUrl } from '@/components/properties/monitoring/monitoring.actions';

const VISIT_STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned',
  accepted: 'Agent on the way',
  submitted: 'Under review',
  approved: 'Report ready',
  ec_pending: 'Report ready — EC pending',
  rejected: 'Sent back for changes',
};

// Redesign 2026-09 (follow-up) — this screen was originally built as a
// simpler, plainer adaptation of design_handoff_plot360_redesign's "Plot360
// Customer.dc.html" "Property visit history" mock (no image header, no
// milestone track, no dotted timeline) and that simplification was never
// actually flagged to Plot as a deviation the way it should have been.
// Plot caught it by screenshot next to the phone mockup — this rebuilds it
// to match: back-button header, a site-photo block (the mock itself is a
// plain grey rectangle — there's no real property-level photo field in the
// schema — so this shows the first approved photo from the property's most
// recently completed visit when one exists, per round 27's follow-up below,
// and falls back to the plain placeholder only when no visit photo exists
// yet), the location/size line, the
// REGISTERED/VERIFIED/VISIT SET/REPORT track (shared with CustomerHome.tsx
// via lib/visitCredits.ts, milestoneStage/MILESTONES), the visit-credits
// row, and a dotted visit-history timeline. Still deliberately does NOT
// re-render the old PropertyView/MonitoringStatus components — those stay
// kept but unused, per the redesign's "don't remove existing code" rule.
//
// One honest substitution for data the schema doesn't have:
//  - The mock's per-visit note ("Boundary intact. Grass overgrown...") is
//    real content coming from the agent's own submitted
//    monitoring_jobs.observations for a completed visit, or
//    admin_feedback for one sent back — not invented.
//
// Redesign 2026-09 (follow-up, round 27) — Plot: "the picture is not
// loading" on this screen turned out to be this exact placeholder — it was
// never wired to a real photo (see the comment above), so for a property
// with completed visits and real uploaded photos it just permanently shows
// grey. Now pulls the first approved photo from the property's latest
// completed visit (monitoring_media, same signed-URL helper the report
// screens use) and shows the plain placeholder only when none exists.
//
// Redesign 2026-09 (2026-09-22) — Plot asked for the "P-<code>" shorthand
// (e.g. "P-C55B") to not be shown at all — it read like a real
// registration/reference number rather than the display-only cosmetic
// stand-in for the mock's "P-1042" it actually was. Dropped from the
// location line here and on VisitReportView.tsx (same pattern).
export async function PropertyVisitHistory({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const [{ data: property }, credits, { data: jobs }, reservedCounts] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    getVisitCreditsForProperty(propertyId),
    supabase
      .from('monitoring_jobs')
      .select('id, status, visit_number, assigned_at, decided_at, observations, admin_feedback')
      .eq('property_id', propertyId)
      .order('assigned_at', { ascending: false }),
    getReservedCreditCounts([propertyId]),
  ]);

  if (!property) return <p className="p360" style={{ padding: 24 }}>Property not found.</p>;

  const reserved = reservedCounts[propertyId] ?? 0;
  const remaining = Math.max(totalRemainingCredits(credits) - reserved, 0);
  const totalPurchased = credits.reduce((sum, c) => sum + c.quantity_purchased, 0);
  const expiry = nearestExpiry(credits);
  const allJobs = jobs ?? [];
  const gate = canScheduleVisit(property.status, credits, allJobs.length > 0);
  const stage = milestoneStage(property, allJobs, reserved > 0);
  // Redesign 2026-09 (follow-up, 2026-09-26) — Plot screenshotted this
  // page showing "3 of 4 left" right above "0 of 4 visits used" for the
  // same property — a real, visible contradiction. It counted only
  // approved/ec_pending jobs as "used", while "left" above it already
  // subtracts `reserved` (a visit that's assigned/in progress but not yet
  // approved still ties up a credit). Deriving "used" from the same
  // totalPurchased/remaining figures the credits row already shows keeps
  // the two numbers always consistent (used + remaining = totalPurchased,
  // by construction) instead of drifting apart from being computed two
  // different ways.
  const usedCount = Math.max(totalPurchased - remaining, 0);
  const latestVisitNumber = allJobs[0]?.visit_number ?? null;

  // allJobs is already ordered newest-first (by assigned_at), so the first
  // one with a completed status is the latest visit that has real photos.
  const latestCompletedJob = allJobs.find((j) => ['approved', 'ec_pending'].includes(j.status)) ?? null;
  let sitePhotoUrl: string | null = null;
  if (latestCompletedJob) {
    const { data: photoRow } = await supabase
      .from('monitoring_media')
      .select('file_path')
      .eq('job_id', latestCompletedJob.id)
      .eq('media_type', 'photo')
      .order('uploaded_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (photoRow) {
      sitePhotoUrl = await getMonitoringMediaDownloadUrl(photoRow.file_path);
    }
  }
  const sitePhotoVisitNumber = latestCompletedJob?.visit_number ?? latestVisitNumber;

  const locationParts = [property.village_town || property.district, property.plot_size ? `${property.plot_size} ${property.plot_size_unit || 'sq yd'}` : null].filter(
    Boolean
  );

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to dashboard">
          ←
        </Link>
        <h1 style={{ fontSize: 17 }}>{property.property_name}</h1>
      </div>

      {/* Site photo — real photo from the latest completed visit when one
          exists; plain placeholder (no real property-level photo field in
          the schema) otherwise */}
      {sitePhotoUrl ? (
        <div style={{ height: 160, position: 'relative', background: 'var(--color-neutral-300)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sitePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12,
              fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
              color: 'var(--color-bg)', background: 'rgba(32,30,29,.55)',
            }}
          >
            Site photo{sitePhotoVisitNumber ? ` · Visit ${sitePhotoVisitNumber}` : ''}
          </span>
        </div>
      ) : (
        <div style={{ height: 160, background: 'var(--color-neutral-300)', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--color-text)' }}>
            Site photo{latestVisitNumber ? ` · Visit ${latestVisitNumber}` : ''}
          </span>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px 20px 0' }}>
        {locationParts.length > 0 && <p style={{ fontSize: 13, color: 'var(--p-ink-soft)' }}>{locationParts.join(' · ')}</p>}

        {property.status === 'rejected' && property.rejection_reason && (
          <div className="card" style={{ borderColor: 'var(--color-accent)', marginTop: 16 }}>
            <p style={{ fontSize: 13.5 }}>{property.rejection_reason}</p>
          </div>
        )}

        {/* Milestone track */}
        <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {MILESTONES.map((m, i) => (
            <div key={m} style={{ flex: 1 }}>
              <div style={{ height: 5, background: i < stage ? 'var(--color-accent)' : 'var(--color-divider)' }} />
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 5, color: i < stage ? 'var(--color-text)' : 'var(--p-ink-muted)', lineHeight: 1.2 }}>
                {m}
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '20px 0' }} />

        {/* Visit credits */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)' }}>Visit credits</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24, marginTop: 2 }}>
              {remaining} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--p-ink-soft)' }}>of {totalPurchased} left</span>
            </div>
          </div>
          {expiry && (
            <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.45 }}>
              Usable until
              <br />
              {expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>

        {gate.eligible && gate.hasCredits && remaining > 0 ? (
          <Link href={`/properties/${propertyId}/schedule`} className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 13.5, marginTop: 14, textDecoration: 'none' }}>
            Schedule the next visit
          </Link>
        ) : (
          <Link href={`/properties/${propertyId}/plan`} className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 13.5, marginTop: 14, textDecoration: 'none' }}>
            Buy visit credits
          </Link>
        )}
        {!gate.eligible && gate.reason && <p style={{ fontSize: 12.5, color: 'var(--p-ink-muted)', marginTop: 10 }}>{gate.reason}</p>}
        <Link href="/service-requests/new" className="nav-link" style={{ display: 'inline-block', fontSize: 12.5, marginTop: 10 }}>
          Raise a service request
        </Link>
      </div>

      {/* Visit history */}
      <div style={{ marginTop: 22, borderTop: '2px solid var(--color-divider)', padding: '16px 20px 0' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 17 }}>Visit history</h2>
            {totalPurchased > 0 && (
              <span className="tag" style={{ fontSize: 10, border: '1px solid var(--color-divider)' }}>
                {usedCount} of {totalPurchased} visits used
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 6 }}>
            Every completed visit on this property, newest first. Each one used a visit credit.
          </p>

          {allJobs.length === 0 && <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)', marginTop: 14 }}>No visits yet.</p>}

          <div style={{ marginTop: 14 }}>
            {allJobs.map((j) => {
              const isReport = ['approved', 'ec_pending'].includes(j.status);
              const note = isReport ? j.observations : j.status === 'rejected' ? j.admin_feedback : null;
              return (
                <div key={j.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--color-divider)' }}>
                  <div style={{ width: 72, flex: 'none', fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--p-ink-soft)', paddingTop: 2 }}>
                    {(j.decided_at ?? j.assigned_at)?.slice(0, 10)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      Visit {j.visit_number ?? '—'} — {VISIT_STATUS_LABEL[j.status] ?? j.status}
                    </div>
                    {note && <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.45, marginTop: 2 }}>{note}</div>}
                    {isReport && (
                      // Redesign 2026-09 (follow-up, round 26) — Plot: per the mock,
                      // "open visit report" shows the report's own details screen
                      // (photos, on-site checks, any note from Plot360) with a
                      // "Download report PDF" button at the bottom — not a jump
                      // straight into the raw PDF. See VisitReportView.tsx.
                      <Link href={`/properties/${propertyId}/visit-report/${j.id}/view`} className="nav-link" style={{ fontSize: 12, display: 'inline-block', marginTop: 4 }}>
                        Open visit {j.visit_number ?? ''} report
                      </Link>
                    )}
                  </div>
                  <div style={{ width: 8, height: 8, background: isReport ? 'var(--color-accent)' : 'var(--color-text)', flex: 'none', marginTop: 6 }} />
                </div>
              );
            })}
          </div>
          <div style={{ height: 34 }} />
        </div>
      </div>
    </div>
  );
}
