'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitJobWork, uploadJobMedia, deleteJobMedia } from './agent-jobs.actions';
import { VisitQuestionsFields } from './VisitQuestionsFields';

export function AgentJobDetail({ job, media }: { job: any; media: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [uploadPending, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const property = job.properties;
  const router = useRouter();

  const photos = media.filter((m) => m.media_type === 'photo');
  const videos = media.filter((m) => m.media_type === 'video');
  const documents = media.filter((m) => m.media_type === 'document');

  function handleUpload(formData: FormData) {
    setUploadError(null);
    startUpload(async () => {
      const result = await uploadJobMedia(job.id, formData);
      if (result?.error) setUploadError(result.error);
      else router.refresh();
    });
  }

  function handleDelete(mediaId: string) {
    setUploadError(null);
    setDeletingId(mediaId);
    startUpload(async () => {
      const result = await deleteJobMedia(job.id, mediaId);
      if (result?.error) setUploadError(result.error);
      setDeletingId(null);
      router.refresh();
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitJobWork(job.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  const locked = job.status === 'approved';
  const canUpload = job.status === 'assigned' || job.status === 'accepted' || job.status === 'rejected';

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h2 style={{ marginBottom: 4 }}>{property?.property_name}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        {property?.street_address}, {property?.village_town}, {property?.district}, {property?.state}
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 12 }}>Location</h4>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8 }}>
          <div><dt className="field-label">GPS Coordinate</dt><dd>{property?.plot_gps_coordinate || '—'}</dd></div>
          <div><dt className="field-label">Nearby Landmark</dt><dd>{property?.near_by_landmark || '—'}</dd></div>
        </dl>
        {property?.google_map_lat && property?.google_map_lng && (
          <iframe
            title="Job location"
            width="100%"
            height="260"
            style={{ border: 0, borderRadius: 'var(--radius-input)', marginTop: 12 }}
            loading="lazy"
            src={`https://www.google.com/maps?q=${property.google_map_lat},${property.google_map_lng}&output=embed`}
          />
        )}
      </div>

      {job.status === 'rejected' && job.admin_feedback && (
        <div className="card section-alt" style={{ marginBottom: 24, borderColor: 'var(--color-danger)' }}>
          <p className="field-label" style={{ marginBottom: 6 }}>Admin feedback</p>
          <p style={{ fontSize: 14 }}>{job.admin_feedback}</p>
        </div>
      )}

      {/* Media grid — every upload shows here immediately as a clickable item */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 4 }}>Uploaded media</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} · {videos.length} video{videos.length === 1 ? '' : 's'}
          {documents.length > 0 && ` · ${documents.length} document${documents.length === 1 ? '' : 's'}`}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: photos.length ? 16 : 0 }}>
          {photos.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              <a href={m.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-input)' }} />
              </a>
              {canUpload && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={uploadPending}
                  title="Remove"
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%',
                    border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                  }}
                >
                  {deletingId === m.id ? '…' : '✕'}
                </button>
              )}
            </div>
          ))}
        </div>

        {videos.map((m) => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            <video controls style={{ width: '100%', borderRadius: 'var(--radius-input)' }}>
              <source src={m.url} />
            </video>
            {canUpload && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleDelete(m.id)}
                disabled={uploadPending}
                style={{ marginTop: 6, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 13, padding: '6px 16px' }}
              >
                {deletingId === m.id ? 'Removing…' : 'Remove video'}
              </button>
            )}
          </div>
        ))}

        {documents.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 0 }}>
            {documents.map((m) => (
              <li key={m.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                <a href={m.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
                  {m.file_path.split('/').pop()}
                </a>
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    disabled={uploadPending}
                    style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 13 }}
                  >
                    {deletingId === m.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {uploadError && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{uploadError}</p>}
        {media.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing uploaded yet.</p>}

        {canUpload && (
          <form action={handleUpload} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <label className="field-label">Add photos, video, or a document</label>
            <input className="field-input" type="file" name="media" accept="image/*,video/*,.pdf" multiple style={{ marginBottom: 12 }} />
            <button className="btn-primary" type="submit" disabled={uploadPending}>
              {uploadPending ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        )}
      </div>

      {canUpload && (
        <form action={handleSubmit} className="card">
          <h4 style={{ marginBottom: 16 }}>{job.status === 'rejected' ? 'Resubmit your visit' : 'Submit your visit'}</h4>
          <VisitQuestionsFields defaultValues={job.status === 'rejected' ? job : undefined} />
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Additional observations<span style={{ color: 'var(--color-danger)' }}> *</span></label>
            <textarea
              className="field-input"
              name="observations"
              rows={4}
              required
              placeholder="Anything else the admin should know: access issues, discrepancies, etc."
              defaultValue={job.status === 'rejected' ? job.observations ?? '' : ''}
            />
          </div>
          {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={isPending || media.length === 0}>
            {isPending ? 'Submitting…' : 'Submit for review'}
          </button>
          {media.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>Upload at least one photo or video first.</p>
          )}
        </form>
      )}

      {job.status === 'submitted' && (
        <div className="card">
          <p style={{ color: 'var(--color-text-muted)' }}>Submitted — waiting for admin review.</p>
        </div>
      )}

      {locked && (
        <div className="card">
          <span className="status-pill verified">Completed</span>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>
            This job is approved and locked — no further changes can be made.
          </p>
        </div>
      )}
    </div>
  );
}
