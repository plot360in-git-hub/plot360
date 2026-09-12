import { getMonitoringHistoryForProperty, getApprovedMonitoringMedia, getMonitoringMediaDownloadUrl, getEcDigitalCopyForProperty } from './monitoring.actions';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned — visit in progress',
  accepted: 'Agent assigned — visit in progress',
  submitted: 'Agent submitted — under admin review',
  approved: 'Verified by field agent',
  ec_pending: 'Verified — Encumbrance Certificate pending',
  rejected: 'Sent back to agent for changes',
};
const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  ec_pending: 'pending',
  rejected: 'rejected',
};

// A job counts as "media released" once it's approved OR ec_pending —
// the site visit itself is confirmed good either way; ec_pending just
// means the separate Digital EC document is still outstanding before the
// job is considered fully closed (see decideMonitoringJob).
const MEDIA_VISIBLE_STATUSES = ['approved', 'ec_pending'];

export async function MonitoringStatus({ propertyId }: { propertyId: string }) {
  const [jobs, ecDoc] = await Promise.all([
    getMonitoringHistoryForProperty(propertyId),
    getEcDigitalCopyForProperty(propertyId),
  ]);
  if (jobs.length === 0) return null;

  const mediaVisibleJobs = jobs.filter((j) => MEDIA_VISIBLE_STATUSES.includes(j.status));
  const mediaVisibleInOrder = [...mediaVisibleJobs].sort(
    (a, b) => new Date(a.decided_at ?? 0).getTime() - new Date(b.decided_at ?? 0).getTime()
  );
  const visitNumberByJob: Record<string, number> = {};
  mediaVisibleInOrder.forEach((j, i) => {
    visitNumberByJob[j.id] = i + 1;
  });

  const mediaByJob = await Promise.all(
    mediaVisibleJobs.map(async (j) => {
      const media = await getApprovedMonitoringMedia(j.id);
      const withUrls = await Promise.all(
        media.map(async (m) => ({ ...m, url: await getMonitoringMediaDownloadUrl(m.file_path) }))
      );
      return { jobId: j.id, media: withUrls };
    })
  );

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Physical Verification (Monitoring)</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
        Twice-yearly on-site checks carried out by a Plot360 field agent.
      </p>
      {mediaVisibleJobs.length > 0 && (
        <div
          style={{
            background: '#fbf0da',
            border: '1px solid var(--color-pending)',
            borderRadius: 'var(--radius-input)',
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <strong>Please download and keep a copy.</strong> Save these photos/videos to your email,
          Google Drive, or another cloud drive — Plot360 may remove them from our storage after 1 year.
        </div>
      )}
      {ecDoc && (
        <div className="card section-alt" style={{ marginBottom: 16 }}>
          <p className="field-label" style={{ marginBottom: 6 }}>Digital Encumbrance Certificate</p>
          {ecDoc.url ? (
            <a href={ecDoc.url} style={{ fontSize: 13, color: 'var(--color-link)' }}>
              📄 {ecDoc.filePath.split('/').pop()}
            </a>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Link unavailable right now.</span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {jobs.map((j) => {
          const jobMedia = mediaByJob.find((m) => m.jobId === j.id)?.media ?? [];
          return (
            <div key={j.id} style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14 }}>
                  {j.decided_at?.slice(0, 10) ?? j.submitted_at?.slice(0, 10) ?? j.accepted_at?.slice(0, 10) ?? j.assigned_at?.slice(0, 10)}
                </span>
                <span className={`status-pill ${STATUS_CLASS[j.status]}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
              </div>
              {j.status === 'ec_pending' && (
                <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Your visit photos/videos are below. Full verification completes once the Encumbrance
                  Certificate is processed.
                </p>
              )}
              {MEDIA_VISIBLE_STATUSES.includes(j.status) && jobMedia.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p className="field-label" style={{ marginBottom: 6 }}>
                    Verification {visitNumberByJob[j.id]} of 2 — photos/videos
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {jobMedia.map((m) =>
                      m.url ? (
                        <a
                          key={m.id}
                          href={m.url}
                          style={{
                            fontSize: 13,
                            color: 'var(--color-link)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 8,
                            padding: '4px 10px',
                          }}
                        >
                          {m.media_type === 'video' ? '🎥' : m.media_type === 'document' ? '📄' : '📷'}{' '}
                          {m.file_path.split('/').pop()}
                        </a>
                      ) : null
                    )}
                  </div>
                  <a href={`/properties/${propertyId}/visit-report/${j.id}`} style={{ fontSize: 13, color: 'var(--color-link)' }}>
                    View full visit report (printable / save as PDF)
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
