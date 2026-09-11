'use client';

import { useState, useTransition } from 'react';
import { uploadMediaByToken, deleteMediaByToken, submitByToken } from './magic-link.actions';

export function PublicUploadForm({
  token,
  job,
  property,
  media,
}: {
  token: string;
  job: any;
  property: any;
  media: any[];
}) {
  const [uploadPending, startUpload] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(job.status === 'submitted');
  const [items, setItems] = useState(media);

  const photos = items.filter((m) => m.media_type === 'photo');
  const videos = items.filter((m) => m.media_type === 'video');
  const documents = items.filter((m) => m.media_type === 'document');

  function refreshMedia() {
    window.location.reload();
  }

  function handleUpload(formData: FormData) {
    setUploadError(null);
    startUpload(async () => {
      const result = await uploadMediaByToken(token, formData);
      if (result?.error) setUploadError(result.error);
      else refreshMedia();
    });
  }

  function handleDelete(mediaId: string) {
    setDeletingId(mediaId);
    startUpload(async () => {
      const result = await deleteMediaByToken(token, mediaId);
      if (result?.error) setUploadError(result.error);
      setDeletingId(null);
      if (!result?.error) setItems((prev) => prev.filter((m) => m.id !== mediaId));
    });
  }

  function handleSubmit(formData: FormData) {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await submitByToken(token, formData);
      if (result?.error) setSubmitError(result.error);
      else setSubmitted(true);
    });
  }

  const address = [property.street_address, property.village_town, property.district, property.state].filter(Boolean).join(', ');
  const canEdit = !submitted;

  if (submitted) {
    return (
      <main className="container-narrow" style={{ paddingTop: 60, paddingBottom: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <span className="status-pill verified" style={{ marginBottom: 16, display: 'inline-block' }}>Submitted</span>
          <p>Thanks — your visit for <strong>{property.property_name}</strong> has been submitted for admin review.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h2 style={{ marginBottom: 4 }}>{property.property_name}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>{address}</p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 12 }}>Location</h4>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 8 }}>
          <div><dt className="field-label">Plot Size</dt><dd>{property.plot_size} {property.plot_size_unit}</dd></div>
          <div><dt className="field-label">GPS Coordinate</dt><dd>{property.plot_gps_coordinate || '—'}</dd></div>
          <div><dt className="field-label">Nearby Landmark</dt><dd>{property.near_by_landmark || '—'}</dd></div>
        </dl>
        {property.google_map_lat && property.google_map_lng && (
          <iframe
            title="Job location"
            width="100%"
            height="220"
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

      <div className="card" style={{ marginBottom: 24 }}>
        <h4 style={{ marginBottom: 4 }}>Uploaded media</h4>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          {photos.length} photo{photos.length === 1 ? '' : 's'} · {videos.length} video{videos.length === 1 ? '' : 's'}
          {documents.length > 0 && ` · ${documents.length} document${documents.length === 1 ? '' : 's'}`}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: photos.length ? 16 : 0 }}>
          {photos.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-input)' }} />
                </a>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={uploadPending}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 14 }}
                >
                  {deletingId === m.id ? '…' : '✕'}
                </button>
              )}
            </div>
          ))}
        </div>

        {videos.map((m) => (
          <div key={m.id} style={{ marginBottom: 12 }}>
            {m.url && (
              <video controls style={{ width: '100%', borderRadius: 'var(--radius-input)' }}>
                <source src={m.url} />
              </video>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                disabled={uploadPending}
                className="btn-secondary"
                style={{ marginTop: 6, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', fontSize: 13, padding: '6px 16px' }}
              >
                {deletingId === m.id ? 'Removing…' : 'Remove video'}
              </button>
            )}
          </div>
        ))}

        {documents.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {documents.map((m) => (
              <li key={m.id} style={{ marginBottom: 6, display: 'flex', gap: 10, alignItems: 'center' }}>
                {m.url && <a href={m.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>{m.file_path.split('/').pop()}</a>}
                {canEdit && (
                  <button type="button" onClick={() => handleDelete(m.id)} disabled={uploadPending} style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 13 }}>
                    {deletingId === m.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {uploadError && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{uploadError}</p>}
        {items.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing uploaded yet.</p>}

        <form action={handleUpload} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <label className="field-label">Add photos, video, or a document</label>
          <input className="field-input" type="file" name="media" accept="image/*,video/*,.pdf" multiple capture="environment" style={{ marginBottom: 12 }} />
          <button className="btn-primary" type="submit" disabled={uploadPending}>
            {uploadPending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </div>

      <form action={handleSubmit} className="card">
        <h4 style={{ marginBottom: 16 }}>{job.status === 'rejected' ? 'Resubmit your visit' : 'Submit your visit'}</h4>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Observations<span style={{ color: 'var(--color-danger)' }}> *</span></label>
          <textarea
            className="field-input"
            name="observations"
            rows={4}
            required
            placeholder="Anything the admin should know: plot condition, access issues, discrepancies, etc."
            defaultValue={job.status === 'rejected' ? job.observations ?? '' : ''}
          />
        </div>
        {submitError && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{submitError}</p>}
        <button className="btn-primary" type="submit" disabled={submitPending || items.length === 0}>
          {submitPending ? 'Submitting…' : 'Submit for review'}
        </button>
        {items.length === 0 && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>Upload at least one photo or video first.</p>}
      </form>
    </main>
  );
}
