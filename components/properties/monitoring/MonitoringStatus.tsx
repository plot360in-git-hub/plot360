import { getMonitoringHistoryForProperty, getApprovedMonitoringMedia, getMonitoringMediaDownloadUrl } from './monitoring.actions';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned — visit in progress',
  accepted: 'Agent assigned — visit in progress',
  submitted: 'Agent submitted — under admin review',
  approved: 'Verified by field agent',
  rejected: 'Sent back to agent for changes',
};
const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
};

export async function MonitoringStatus({ propertyId }: { propertyId: string }) {
  const jobs = await getMonitoringHistoryForProperty(propertyId);
  if (jobs.length === 0) return null;

  const approvedJobs = jobs.filter((j) => j.status === 'approved');
  const approvedInOrder = [...approvedJobs].sort(
    (a, b) => new Date(a.decided_at ?? 0).getTime() - new Date(b.decided_at ?? 0).getTime()
  );
  const visitNumberByJob: Record<string, number> = {};
  approvedInOrder.forEach((j, i) => {
    visitNumberByJob[j.id] = i + 1;
  });

  const mediaByJob = await Promise.all(
    approvedJobs.map(async (j) => {
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
      {approvedJobs.length > 0 && (
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
              {j.status === 'approved' && jobMedia.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p className="field-label" style={{ marginBottom: 6 }}>
                    Verification {visitNumberByJob[j.id]} of 2 — photos/videos
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
