import Link from 'next/link';
import { getJobForReview, getMonitoringMediaUrl } from './monitoring.actions';
import { profileDisplayName } from './displayName';
import { MonitoringDecision } from './MonitoringDecision';
import { BackButton } from './BackButton';
import { ResendWhatsAppButton } from './ResendWhatsAppButton';
import { VISIT_QUESTIONS } from '@/lib/visitReportQuestions';

export async function MonitoringJobReview({ jobId }: { jobId: string }) {
  const { job, media, ecRequested, ecUploaded } = await getJobForReview(jobId);
  if (!job) return <p>Job not found.</p>;

  const mediaWithUrls = await Promise.all(
    media.map(async (m: any) => ({ ...m, url: await getMonitoringMediaUrl(m.file_path) }))
  );
  const property = job.properties;

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <BackButton />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h1>{property?.property_name}</h1>
        {job.status !== 'submitted' && job.status !== 'approved' && <ResendWhatsAppButton jobId={job.id} status={job.status} />}
      </div>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Agent: {profileDisplayName(job.agent_profiles?.profiles)} · {job.agent_profiles?.profiles?.phone_number}
        {' · '}
        <Link href={`/admin/${property?.id}`} style={{ color: 'var(--color-link)' }}>View full property</Link>
      </p>

      {ecRequested && (
        <div
          className="card section-alt"
          style={{ marginBottom: 24, borderColor: ecUploaded ? 'var(--color-success)' : 'var(--color-pending)' }}
        >
          <p style={{ fontSize: 14 }}>
            <strong>Digital EC requested:</strong>{' '}
            {ecUploaded ? (
              <span style={{ color: 'var(--color-success)' }}>Already uploaded — approving will close this job normally.</span>
            ) : (
              <span style={{ color: 'var(--color-pending)' }}>
                Not uploaded yet. Approving will release media to the customer but the job will stay
                open as "EC pending" until the EC is uploaded from{' '}
                <Link href={`/admin/${property?.id}`} style={{ color: 'var(--color-link)' }}>the property page</Link>.
              </span>
            )}
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Uploaded media</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          {mediaWithUrls.filter((m) => m.media_type === 'photo' && m.url).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-input)' }} />
          ))}
        </div>
        {mediaWithUrls.filter((m) => m.media_type === 'video' && m.url).map((m) => (
          <video key={m.id} controls style={{ width: '100%', borderRadius: 'var(--radius-input)', marginBottom: 12 }}>
            <source src={m.url} />
          </video>
        ))}
        {mediaWithUrls.filter((m) => m.media_type === 'document' && m.url).length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 12 }}>
            {mediaWithUrls.filter((m) => m.media_type === 'document').map((m) => (
              <li key={m.id}>
                <a href={m.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
                  {m.file_path.split('/').pop()}
                </a>
              </li>
            ))}
          </ul>
        )}
        {mediaWithUrls.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No media uploaded yet.</p>}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Verification Checklist</h3>
        <dl style={{ display: 'grid', rowGap: 10 }}>
          {VISIT_QUESTIONS.map((q) => (
            <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
              <dt style={{ fontSize: 14 }}>{q.label}</dt>
              <dd style={{ fontWeight: 500, textAlign: 'right', marginLeft: 16 }}>
                {q.type === 'boolean' ? (
                  job[q.key] === null || job[q.key] === undefined ? (
                    <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>—</span>
                  ) : (
                    <span className={`status-pill ${job[q.key] ? 'pending' : 'verified'}`}>{job[q.key] ? 'Yes' : 'No'}</span>
                  )
                ) : (
                  job[q.key] || <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>—</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Agent observations</h3>
        <p style={{ fontSize: 14 }}>{job.observations || '—'}</p>
      </div>

      {job.status === 'submitted' ? (
        <MonitoringDecision
          jobId={job.id}
          propertyId={property.id}
          propertyName={property.property_name}
          agentPhoneCountryCode={job.agent_profiles?.profiles?.phone_country_code}
          agentPhoneNumber={job.agent_profiles?.profiles?.phone_number}
        />
      ) : (
        <span className={`status-pill ${job.status === 'approved' ? 'verified' : job.status === 'rejected' ? 'rejected' : 'pending'}`}>
          {job.status === 'ec_pending' ? 'EC pending — job not closed' : job.status}
        </span>
      )}
    </div>
  );
}
