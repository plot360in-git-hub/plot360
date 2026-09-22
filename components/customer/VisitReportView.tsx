import Link from 'next/link';
import { getVisitReportData } from '@/components/properties/monitoring/monitoring.actions';
import { VISIT_QUESTIONS, isConcerningAnswer } from '@/lib/visitReportQuestions';

const REPORT_READY_STATUSES = ['approved', 'ec_pending'];

// Redesign 2026-09 (follow-up, round 26) — Plot: the "Visit N · Done"
// chip and "Open visit N report" button on the Home screen (and, before
// this, the sibling PropertyVisitHistory.tsx too) both linked straight
// to the pre-redesign print-formatted page at
// /properties/[id]/visit-report/[jobId] (kept intact but never meant to
// be customer-facing again — see that page's own comments). Per the
// mock (design_handoff_plot360_redesign, "Plot360 Customer.dc.html",
// "Visit report" screen): the chip itself isn't clickable at all, and
// "open visit report" shows an in-app details screen — photos, the
// agent's on-site checks, any note from Plot360 — with a "Download
// report PDF" button at the bottom, not a jump straight into a raw
// document. This is that screen, a NEW component/route
// (/properties/[id]/visit-report/[jobId]/view) rather than a rewrite of
// the old print page, matching this redesign's own "add beside, repoint
// links, don't remove" pattern used everywhere else (PropertyView.tsx,
// PaymentsOverview.tsx, SubscribeForm.tsx, etc.).
function formatDatePlain(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BOUNDARY_LABELS: Record<string, string> = { N: 'North', E: 'East', S: 'South', W: 'West' };

export async function VisitReportView({ propertyId, jobId }: { propertyId: string; jobId: string }) {
  const data = await getVisitReportData(jobId);

  if (!data || !REPORT_READY_STATUSES.includes(data.job.status)) {
    return (
      <div className="p360" style={{ minHeight: '60vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
          <Link href={`/properties/${propertyId}`} className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to property">
            ←
          </Link>
          <h1 style={{ fontSize: 17 }}>Visit report</h1>
        </div>
        <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p style={{ maxWidth: 380, textAlign: 'center', fontSize: 14.5, color: 'var(--p-ink-soft)' }}>This visit report isn't available yet.</p>
        </div>
      </div>
    );
  }

  const { job, media, siblingVisits } = data;
  const property: any = job.properties;
  const photos = media.filter((m) => m.media_type === 'photo' && m.url);
  const videos = media.filter((m) => m.media_type === 'video' && m.url);
  const visitDate = job.decided_at ?? job.submitted_at;
  // Redesign 2026-09 (2026-09-22) — the "P-<code>" shorthand (e.g.
  // "P-C55B") was dropped from customer-facing screens per Plot's
  // request — see PropertyVisitHistory.tsx for the full explanation.
  const locationParts = [property?.village_town || property?.district, property?.plot_size ? `${property.plot_size} ${property.plot_size_unit || 'sq yd'}` : null].filter(Boolean);
  const gpsText = property?.plot_gps_coordinate || (property?.google_map_lat && property?.google_map_lng ? `${property.google_map_lat}, ${property.google_map_lng}` : null);

  const tabs = (siblingVisits ?? []).filter((v: any) => v.visit_number).slice(0, 8);

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link href={`/properties/${propertyId}`} className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to property">
          ←
        </Link>
        <h1 style={{ fontSize: 17 }}>Visit {job.visit_number ?? ''} report</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px 20px 40px' }}>
        {tabs.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {tabs.map((v: any) => {
              const isCurrent = v.id === jobId;
              const hasReport = REPORT_READY_STATUSES.includes(v.status);
              const label = `Visit ${v.visit_number}`;
              if (isCurrent) {
                return (
                  <span key={v.id} className="tag" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none' }}>
                    {label}
                  </span>
                );
              }
              if (hasReport) {
                return (
                  <Link key={v.id} href={`/properties/${propertyId}/visit-report/${v.id}/view`} className="tag" style={{ border: '1px solid var(--color-divider)', textDecoration: 'none' }}>
                    {label}
                  </Link>
                );
              }
              return (
                <span key={v.id} className="tag" style={{ border: '1px solid var(--color-divider)', color: 'var(--p-ink-muted)' }}>
                  {label}
                </span>
              );
            })}
          </div>
        )}

        <h2 style={{ fontSize: 21, letterSpacing: '-0.02em' }}>{property?.property_name || 'Property'}</h2>
        <p style={{ fontSize: 13, color: 'var(--p-ink-soft)', marginTop: 4 }}>
          Visited {formatDatePlain(visitDate)}{locationParts.length > 0 ? ` · ${locationParts.join(' · ')}` : ''}
        </p>

        {(photos.length > 0 || videos.length > 0) && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
              {photos.map((m, i) => (
                <a key={m.id} href={m.url!} target="_blank" rel="noreferrer" style={{ display: 'block', position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url!} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: 'var(--color-neutral-300)' }} />
                  <span
                    style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0, padding: '4px 8px',
                      fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                      color: 'var(--color-bg)', background: 'rgba(32,30,29,.55)',
                    }}
                  >
                    {m.boundary_side ? `${BOUNDARY_LABELS[m.boundary_side] ?? m.boundary_side} boundary` : `Photo ${i + 1}`}
                  </span>
                </a>
              ))}
              {videos.map((m, i) => (
                <a
                  key={m.id}
                  href={m.url!}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'flex-end', aspectRatio: '4/3', background: 'var(--color-neutral-800)',
                    color: 'var(--color-bg)', padding: '4px 8px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                  }}
                >
                  {`Video ${i + 1}`}
                </a>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 8 }}>
              {photos.length} photo{photos.length === 1 ? '' : 's'}
              {videos.length ? ` · ${videos.length} video${videos.length === 1 ? '' : 's'}` : ''} · tap any to open full screen
            </p>
          </>
        )}

        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)', marginBottom: 10 }}>
            Agent&apos;s on-site checks
          </div>
          {VISIT_QUESTIONS.map((q, i) => {
            const value = job[q.key as keyof typeof job] as string | boolean | null | undefined;
            const display = q.type === 'boolean' ? (value == null ? '—' : value ? 'Yes' : 'No') : (value as string) || '—';
            const concerning = isConcerningAnswer(q.key, value);
            return (
              <div
                key={q.key}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0',
                  borderTop: i === 0 ? '1px solid var(--color-divider)' : 'none', borderBottom: '1px solid var(--color-divider)', fontSize: 12.5,
                }}
              >
                <div style={{ color: 'var(--color-text)' }}>{q.label}</div>
                <div style={{ fontWeight: 600, textAlign: 'right', color: concerning ? 'var(--p-alert)' : 'var(--color-text)', flex: 'none', maxWidth: '45%' }}>{display}</div>
              </div>
            );
          })}
        </div>

        {job.observations && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)', marginBottom: 6 }}>Field agent observations</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55 }}>{job.observations}</p>
          </div>
        )}

        {job.admin_remarks && (
          <div style={{ background: 'var(--color-surface)', borderLeft: '3px solid var(--color-accent)', padding: '13px 16px', marginTop: 18 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)' }}>Note from Plot360</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>{job.admin_remarks}</p>
          </div>
        )}

        {gpsText && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)', marginBottom: 8 }}>Where the photos were taken</div>
            <div style={{ background: 'var(--color-neutral-300)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--color-text)' }}>{gpsText}</span>
            </div>
          </div>
        )}

        <a
          href={`/properties/${propertyId}/visit-report/${jobId}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-block"
          style={{ minHeight: 48, fontSize: 14, marginTop: 26, textDecoration: 'none' }}
        >
          Download report PDF
        </a>
      </div>
    </div>
  );
}
