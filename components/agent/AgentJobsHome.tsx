import Link from 'next/link';
import { getMyJobs } from './agent-jobs.actions';

const OPEN_STATUSES = ['assigned', 'accepted'];
const COMPLETED_STATUSES = ['approved', 'ec_pending'];

// Redesign 2026-09 — "My jobs" (design_handoff_plot360_redesign, "Plot360
// Agent.dc.html"): counts strip (Open / Rework / Completed — a count
// only, no money) then job cards with kind, window, address, SRO, pin,
// a rework note when applicable, and "Open map". AgentJobList.tsx is
// kept intact but no longer wired at app/agent/dashboard/page.tsx.
export async function AgentJobsHome() {
  const jobs = await getMyJobs();

  const open = jobs.filter((j: any) => OPEN_STATUSES.includes(j.status));
  const rework = jobs.filter((j: any) => j.status === 'rejected');
  const completed = jobs.filter((j: any) => COMPLETED_STATUSES.includes(j.status));
  const submitted = jobs.filter((j: any) => j.status === 'submitted');
  // Rework first, then assigned/accepted, then submitted (nothing left to
  // do) — completed jobs aren't shown as cards, only counted above.
  const visible = [...rework, ...open, ...submitted];

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px', borderBottom: '2px solid var(--color-divider)' }}>
        <h1 style={{ fontSize: 18 }}>My jobs</h1>
        <Link href="/agent/profile/edit" className="btn-ghost btn" style={{ fontSize: 12 }}>
          Profile
        </Link>
      </div>

      <div style={{ display: 'flex', padding: '14px 20px 0', borderBottom: '2px solid var(--color-divider)', maxWidth: 520, margin: '0 auto' }}>
        {[
          ['Open', open.length, 'var(--color-text)'],
          ['Rework', rework.length, 'var(--color-accent-700)'],
          ['Completed', completed.length, 'var(--color-text)'],
        ].map(([label, count, color], i) => (
          <div key={label as string} style={{ flex: 1, paddingBottom: 13, borderLeft: i > 0 ? '1px solid var(--color-divider)' : 'none', paddingLeft: i > 0 ? 16 : 0 }}>
            <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)' }}>{label}</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, marginTop: 2, color: color as string }}>{count}</p>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {visible.map((j: any) => {
          const property = j.properties;
          const lat = property?.google_map_lat;
          const lng = property?.google_map_lng;
          const mapLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null;
          const sro = [property?.sro_name, property?.sro_code].filter(Boolean).join(' ');
          const pin = property?.plot_gps_coordinate || (lat && lng ? `${lat}, ${lng}` : null);
          const windowText =
            j.requested_window_start && j.requested_window_end
              ? `${j.requested_window_start.slice(5)}–${j.requested_window_end.slice(5)}`
              : j.assigned_at?.slice(0, 10);

          const kind = j.status === 'rejected' ? 'Rework requested' : j.status === 'submitted' ? 'Submitted' : 'Assigned';
          const cta = j.status === 'rejected' ? 'Redo and resubmit' : j.status === 'submitted' ? null : 'Start capture';

          return (
            <div key={j.id} style={{ borderBottom: '2px solid var(--color-divider)', padding: '15px 20px 16px', background: j.status === 'rejected' ? 'var(--p-tint)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, background: j.status === 'rejected' ? 'var(--color-accent)' : 'var(--color-text)' }} />
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: j.status === 'rejected' ? 'var(--p-alert)' : 'var(--p-ink-soft)' }}>{kind}</span>
                <span style={{ flex: 1 }} />
                {windowText && <span style={{ fontSize: 10.5, color: 'var(--p-ink-muted)' }}>{windowText}</span>}
              </div>
              <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16.5, marginTop: 8 }}>{property?.property_name}</p>
              <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', lineHeight: 1.45, marginTop: 3 }}>
                {[property?.street_address, property?.village_town, property?.district, property?.state].filter(Boolean).join(', ')}
              </p>
              {(sro || pin) && (
                <p style={{ fontSize: 11, color: 'var(--p-ink-muted)', marginTop: 5 }}>
                  {sro && `SRO ${sro}`}
                  {sro && pin && ' · '}
                  {pin && `pin ${pin}`}
                </p>
              )}
              {j.status === 'rejected' && j.admin_feedback && (
                <div style={{ background: 'var(--color-surface)', padding: '11px 12px', borderLeft: '3px solid var(--color-accent)', marginTop: 10 }}>
                  <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)' }}>Rework requested</p>
                  <p style={{ fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>{j.admin_feedback}</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {cta && (
                  <Link href={`/agent/jobs/${j.id}`} className="btn btn-primary" style={{ fontSize: 12.5, padding: '0 14px', textDecoration: 'none' }}>
                    {cta}
                  </Link>
                )}
                {!cta && (
                  <span style={{ fontSize: 12.5, color: 'var(--p-ink-muted)' }}>Awaiting review</span>
                )}
                {mapLink && (
                  <a href={mapLink} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 12.5, padding: '0 14px', textDecoration: 'none' }}>
                    Open map
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p style={{ padding: '24px 20px', fontSize: 13.5, color: 'var(--p-ink-soft)' }}>No open jobs right now.</p>
        )}
        <p style={{ padding: '16px 20px 34px', fontSize: 11.5, color: 'var(--p-ink-muted)', lineHeight: 1.5 }}>
          Jobs are assigned by Plot360 based on your SRO. Owner details are never shared with agents.
        </p>
      </div>
    </div>
  );
}
