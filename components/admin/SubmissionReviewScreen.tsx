import Link from 'next/link';
import { getJobForReview, getMonitoringMediaUrl } from './monitoring.actions';
import { profileDisplayName } from './displayName';
import { TimelineOutboxPanel } from './TimelineOutboxPanel';
import { SubmissionReviewActions } from './SubmissionReviewActions';
import { EcUploadFormP360 } from './EcUploadFormP360';
import { VISIT_QUESTIONS } from '@/lib/visitReportQuestions';
import { hoursSince, formatWait } from '@/lib/adminQueue';

const CONCERNING_WHEN_FALSE = new Set(['q_boundary_intact', 'q_vacant_as_expected', 'q_boundary_markers_visible']);
const CONCERNING_WHEN_TRUE = new Set(['q_encroachment', 'q_illegal_dumping', 'q_unauthorized_construction', 'q_govt_notice_posted', 'q_water_logging']);

// Redesign 2026-09 — admin console, Submission review screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). Replaces
// MonitoringJobReview.tsx on /admin/monitoring/[jobId] (kept intact,
// unreferenced — see ARCHITECTURE.md).
export async function SubmissionReviewScreen({ jobId }: { jobId: string }) {
  const { job, media, ecRequested, ecUploaded } = await getJobForReview(jobId);
  if (!job) return <p style={{ padding: 24 }}>Job not found.</p>;
  if (job.status !== 'submitted') {
    return (
      <div style={{ padding: 24 }}>
        <p>This job isn't awaiting review right now (status: {job.status}).</p>
        <Link href="/admin/queue/agent-submissions" className="btn btn-secondary" style={{ marginTop: 12, display: 'inline-flex' }}>
          Back to queue
        </Link>
      </div>
    );
  }

  const property: any = job.properties;
  const agentProfile: any = job.agent_profiles;
  const mediaUrls = await Promise.all(media.map((m: any) => getMonitoringMediaUrl(m.file_path)));
  const photoCount = media.filter((m: any) => m.media_type === 'photo').length;
  const videoCount = media.filter((m: any) => m.media_type === 'video').length;
  const waitHours = hoursSince(job.submitted_at);
  const mapLink = property?.google_map_lat && property?.google_map_lng ? `https://maps.google.com/?q=${property.google_map_lat},${property.google_map_lng}` : null;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, padding: '22px 24px 30px', overflowY: 'auto' }}>
        <Link href="/admin/queue/agent-submissions" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
          ← Back to queue
        </Link>
        <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>
          {job.visit_number ? `Visit ${job.visit_number} submission` : 'Visit submission'} · {property?.property_name}
        </h2>
        <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
          Submitted {job.submitted_at?.slice(0, 16).replace('T', ' ')} by {profileDisplayName(agentProfile?.profiles)} · {photoCount} photos, {videoCount} video · waiting {formatWait(waitHours)}
        </div>

        {job.flagged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--color-divider)', padding: '11px 13px', marginTop: 16 }}>
            <div style={{ width: 8, height: 8, background: 'var(--color-accent)', flex: 'none' }} />
            <div style={{ flex: 1, fontSize: 12.5 }}>
              Location flagged{job.gps_distance_meters ? ` — photos taken ${Math.round(job.gps_distance_meters)} m from the recorded pin` : ''}
            </div>
            {mapLink && (
              <a href={mapLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 11.5, flex: 'none' }}>
                See on map
              </a>
            )}
          </div>
        )}

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 20 }}>Photographs and video</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 10 }}>
          {media.map((m: any, i: number) => {
            const url = mediaUrls[i];
            const label = m.media_type === 'video' ? 'video' : m.boundary_side ? `${m.boundary_side} side` : m.media_type;
            return (
              <a key={m.id} href={url ?? undefined} target="_blank" rel="noreferrer" style={{ aspectRatio: '1', background: 'var(--color-neutral-300)', display: 'flex', alignItems: 'flex-end', padding: 5, textDecoration: 'none' }}>
                <span style={{ fontSize: 8.5, fontWeight: 600, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {String(i + 1).padStart(2, '0')} {label}
                </span>
              </a>
            );
          })}
          {media.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>No media uploaded.</p>}
        </div>

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 22 }}>The ten checks, as answered</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 26px', marginTop: 9 }}>
          {VISIT_QUESTIONS.map((q) => {
            const value = (job as any)[q.key];
            const display = q.type === 'boolean' ? (value ? 'Yes' : 'No') : value || '—';
            const concerning = q.type === 'boolean' && ((value && CONCERNING_WHEN_TRUE.has(q.key)) || (!value && CONCERNING_WHEN_FALSE.has(q.key)));
            return (
              <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
                <span style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.35 }}>{q.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: concerning ? 'var(--p-alert)' : 'var(--color-text)', textAlign: 'right', flex: 'none', maxWidth: '45%' }}>{display}</span>
              </div>
            );
          })}
        </div>
        {job.observations && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Agent's notes</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 6 }}>{job.observations}</p>
          </div>
        )}

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {ecRequested && (
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>EC copy</div>
                <EcUploadFormP360 propertyId={job.property_id} uploaded={ecUploaded} />
              </div>
            )}
          </div>
        </div>

        <SubmissionReviewActions jobId={jobId} propertyId={job.property_id} propertyName={property?.property_name ?? 'this property'} />
      </div>

      <TimelineOutboxPanel entityType="monitoring_job" entityId={jobId} whatsappEntityType="monitoring_job" />
    </div>
  );
}
