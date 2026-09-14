'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { VisitQuestionsFields } from './VisitQuestionsFields';
import { findOversizedImages, formatFileSize } from '@/lib/fileValidation';
import { haversineMeters, GPS_FLAG_THRESHOLD_METERS } from '@/lib/geo';
import { VISIT_QUESTIONS } from '@/lib/visitReportQuestions';

const MIN_PHOTOS = 8;
const SIDES = [
  { key: 'N', label: 'North boundary photographed' },
  { key: 'E', label: 'East boundary photographed' },
  { key: 'S', label: 'South boundary photographed' },
  { key: 'W', label: 'West boundary photographed' },
] as const;

type MediaItem = { id: string; media_type: string; file_path: string; boundary_side: string | null; url: string | null };

// Redesign 2026-09 — the agent app's capture screen (design_handoff_
// plot360_redesign, "Plot360 Agent.dc.html"), shared between the
// authenticated route (AgentCapture.tsx, /agent/jobs/[id]) and the
// no-login magic-link route (PublicCapture.tsx, /m/[token]) — both wrap
// this component and just bind the right server actions, since the two
// paths render an identical screen over the same monitoring_jobs row.
//
// "Boundary sides covered" is derived from which sides have at least one
// uploaded photo tagged (monitoring_media.boundary_side, chosen via the
// optional selector next to the upload button) rather than a separate
// manual checklist — the design's own mock keeps them independent, but
// deriving it from actual photos is more honest and finally puts that
// column (added in the foundation phase) to use.
export function AgentCaptureScreen({
  mode,
  propertyName,
  address,
  sro,
  pin,
  mapLink,
  propertyLat,
  propertyLng,
  visitLabel,
  job,
  media,
  onUpload,
  onDelete,
  onSubmit,
  backHref,
}: {
  mode: 'authenticated' | 'magic';
  propertyName: string;
  address: string;
  sro: string | null;
  pin: string | null;
  mapLink: string | null;
  propertyLat: number | null;
  propertyLng: number | null;
  visitLabel: string;
  job: { status: string; admin_feedback: string | null } & Record<string, any>;
  media: MediaItem[];
  onUpload: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  onDelete: (mediaId: string) => Promise<{ error?: string; success?: boolean }>;
  onSubmit: (formData: FormData) => Promise<{ error?: string; success?: boolean }>;
  backHref?: string;
}) {
  const [items, setItems] = useState(media);
  const [uploadPending, startUpload] = useTransition();
  const [submitPending, startSubmit] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(job.status === 'submitted');
  const [boundarySide, setBoundarySide] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gps, setGps] = useState<{ distance: number | null; checking: boolean; error: string | null }>({
    distance: null,
    checking: false,
    error: null,
  });

  useEffect(() => setItems(media), [media]);

  function checkGps() {
    if (propertyLat == null || propertyLng == null) {
      setGps({ distance: null, checking: false, error: 'No GPS pin recorded for this property — distance can’t be checked.' });
      return;
    }
    if (!('geolocation' in navigator)) {
      setGps({ distance: null, checking: false, error: 'Location isn’t available on this device.' });
      return;
    }
    setGps((g) => ({ ...g, checking: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = haversineMeters(pos.coords.latitude, pos.coords.longitude, propertyLat, propertyLng);
        setGps({ distance: Math.round(d), checking: false, error: null });
      },
      () => setGps({ distance: null, checking: false, error: 'Couldn’t get your location — check permissions and try again.' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    checkGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photos = items.filter((m) => m.media_type === 'photo');
  const videos = items.filter((m) => m.media_type === 'video');
  const documents = items.filter((m) => m.media_type === 'document');
  const sidesCovered = useMemo(() => new Set(photos.map((p) => p.boundary_side).filter(Boolean)), [photos]);

  const answeredCount = VISIT_QUESTIONS.filter((q) => {
    const v = answers[q.key];
    return v !== undefined && v !== '';
  }).length;

  const gatePhotos = photos.length >= MIN_PHOTOS;
  const gateSides = sidesCovered.size === 4;
  const gateVideo = videos.length >= 1;
  const gateAnswers = answeredCount === VISIT_QUESTIONS.length;
  const ready = gatePhotos && gateSides && gateVideo && gateAnswers;

  const canEdit = job.status !== 'submitted' && job.status !== 'approved' && job.status !== 'ec_pending' && !submitted;

  function handleUpload(formData: FormData) {
    setUploadError(null);
    const files = formData.getAll('media') as File[];
    const oversized = findOversizedImages(files);
    if (oversized.length > 0) {
      setUploadError(
        `${oversized.length > 1 ? 'These photos are' : 'This photo is'} too large (max 50MB each): ${oversized
          .map((f) => `${f.name} (${formatFileSize(f.size)})`)
          .join(', ')}`
      );
      return;
    }
    if (boundarySide) formData.set('boundary_side', boundarySide);
    startUpload(async () => {
      const result = await onUpload(formData);
      if (result?.error) setUploadError(result.error);
    });
  }

  function handleDelete(mediaId: string) {
    setDeletingId(mediaId);
    startUpload(async () => {
      const result = await onDelete(mediaId);
      if (result?.error) setUploadError(result.error);
      else setItems((prev) => prev.filter((m) => m.id !== mediaId));
      setDeletingId(null);
    });
  }

  function handleSubmit(formData: FormData) {
    setSubmitError(null);
    if (gps.distance != null) formData.set('gps_distance_meters', String(gps.distance));
    startSubmit(async () => {
      const result = await onSubmit(formData);
      if (result?.error) setSubmitError(result.error);
      else setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="p360" style={{ minHeight: '70vh' }}>
        <div style={{ background: 'var(--color-accent)', color: 'var(--color-bg)', padding: '26px 22px 24px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.85, marginBottom: 10 }}>
            Submitted for review
          </p>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>Sent. Nothing more to do here.</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            A Plot360 reviewer checks your photos and answers. If something needs redoing you get a WhatsApp with a
            fresh link.
          </p>
        </div>
        <div style={{ padding: '18px 22px 34px', maxWidth: 480, margin: '0 auto' }}>
          {[
            ['Property', propertyName],
            ['Uploaded', `${photos.length} photos · ${videos.length} video${videos.length === 1 ? '' : 's'}`],
            ['Location', gps.distance != null ? (gps.distance > GPS_FLAG_THRESHOLD_METERS ? `Flagged — ${gps.distance} m from pin` : 'Matched pin') : 'Not checked'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--color-divider)', fontSize: 13 }}>
              <span style={{ color: 'var(--p-ink-soft)' }}>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
          {mode === 'authenticated' && backHref && (
            <a href={backHref} className="btn btn-primary btn-block" style={{ textDecoration: 'none', marginTop: 16 }}>
              Back to my jobs
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p360" style={{ minHeight: '70vh', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        {mode === 'authenticated' && backHref && (
          <a href={backHref} className="nav-link" style={{ fontSize: 17, textDecoration: 'none' }}>
            ←
          </a>
        )}
        <div>
          <h1 style={{ fontSize: 15.5 }}>{propertyName}</h1>
          <p style={{ fontSize: 11, color: 'var(--p-ink-muted)' }}>{visitLabel}</p>
        </div>
      </div>

      {mode === 'magic' && (
        <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '11px 20px', fontSize: 12, lineHeight: 1.5 }}>
          Opened from your WhatsApp link. No login needed — this link stops working once you submit, or after 7
          days.
        </div>
      )}

      {job.status === 'rejected' && job.admin_feedback && (
        <div style={{ margin: '16px 20px 0', background: 'var(--color-surface)', borderLeft: '3px solid var(--color-accent)', padding: '11px 12px' }}>
          <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)' }}>Rework requested</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 5 }}>{job.admin_feedback}</p>
        </div>
      )}

      <div style={{ padding: '16px 20px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ border: '1px solid var(--color-divider)', padding: '12px 13px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 8,
              height: 8,
              marginTop: 5,
              flexShrink: 0,
              background: gps.error ? 'var(--p-ink-muted)' : gps.distance != null && gps.distance > GPS_FLAG_THRESHOLD_METERS ? 'var(--color-accent)' : 'var(--color-text)',
            }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600 }}>
              {gps.checking
                ? 'Checking your location…'
                : gps.error
                ? gps.error
                : gps.distance != null
                ? `${gps.distance} m from the recorded pin`
                : 'Location not checked yet'}
            </p>
            {gps.distance != null && !gps.error && (
              <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 2 }}>
                {gps.distance > GPS_FLAG_THRESHOLD_METERS
                  ? 'You can still submit. The distance is recorded and flagged for the reviewer.'
                  : 'Location matches. Nothing to flag.'}
              </p>
            )}
          </div>
          <button type="button" className="btn-ghost btn" style={{ fontSize: 11.5, flexShrink: 0 }} onClick={checkGps}>
            Recheck
          </button>
        </div>

        {mapLink && (
          <a href={mapLink} target="_blank" rel="noreferrer" className="nav-link" style={{ display: 'inline-block', fontSize: 12, marginTop: 8, textDecoration: 'none' }}>
            Open map →
          </a>
        )}
        {(sro || pin) && (
          <p style={{ fontSize: 11, color: 'var(--p-ink-muted)', marginTop: 6 }}>
            {sro && `SRO ${sro}`}
            {sro && pin && ' · '}
            {pin && `pin ${pin}`}
          </p>
        )}
        {address && <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 4 }}>{address}</p>}

        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)', marginTop: 20 }}>
          Photographs · {photos.length} of {MIN_PHOTOS} minimum
        </p>
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {Array.from({ length: MIN_PHOTOS }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 5, background: i < photos.length ? (photos.length >= MIN_PHOTOS ? 'var(--color-text)' : 'var(--color-accent)') : 'var(--color-divider)' }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
          {photos.map((m) => (
            <div key={m.id} style={{ position: 'relative', aspectRatio: '1', background: 'var(--color-surface)' }}>
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </a>
              )}
              {m.boundary_side && (
                <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, fontWeight: 700, background: 'rgba(32,30,29,0.75)', color: '#fff', padding: '1px 5px' }}>
                  {m.boundary_side}
                </span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={uploadPending}
                  style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                >
                  {deletingId === m.id ? '…' : '✕'}
                </button>
              )}
            </div>
          ))}
          {videos.map((m) => (
            <div key={m.id} style={{ position: 'relative', aspectRatio: '1', background: 'var(--color-neutral-900)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-bg)', fontSize: 20 }}>▶</div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={uploadPending}
                  style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12 }}
                >
                  {deletingId === m.id ? '…' : '✕'}
                </button>
              )}
            </div>
          ))}
        </div>

        {documents.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
            {documents.map((m) => (
              <li key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, marginBottom: 6 }}>
                {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="nav-link">{m.file_path.split('/').pop()}</a>}
                {canEdit && (
                  <button type="button" onClick={() => handleDelete(m.id)} disabled={uploadPending} style={{ border: 'none', background: 'none', color: 'var(--p-alert)', cursor: 'pointer', fontSize: 12 }}>
                    {deletingId === m.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {uploadError && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginTop: 10 }}>{uploadError}</p>}

        {canEdit && (
          <form action={handleUpload} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <select
                className="input"
                value={boundarySide}
                onChange={(e) => setBoundarySide(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Tag boundary side (optional)</option>
                <option value="N">North</option>
                <option value="E">East</option>
                <option value="S">South</option>
                <option value="W">West</option>
              </select>
            </div>
            <input className="input" type="file" name="media" accept="image/*,video/*,.pdf" multiple capture={mode === 'magic' ? 'environment' : undefined} style={{ marginBottom: 8 }} />
            <button type="submit" className="btn btn-secondary btn-block" disabled={uploadPending}>
              {uploadPending ? 'Uploading…' : 'Add photo / video'}
            </button>
          </form>
        )}

        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)', marginTop: 22 }}>
          Boundary sides covered
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 9 }}>
          {SIDES.map((sd) => (
            <div key={sd.key} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '9px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span style={{ width: 15, height: 15, border: '1px solid var(--color-text)', background: sidesCovered.has(sd.key) ? 'var(--color-accent)' : 'transparent', flexShrink: 0 }} />
              <span>{sd.label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)', marginBottom: 8 }}>
            On-site checks · {answeredCount} of {VISIT_QUESTIONS.length}
          </p>
        </div>
      </div>

      {canEdit && (
        <form action={handleSubmit} style={{ padding: '0 20px', maxWidth: 480, margin: '0 auto' }}>
          <VisitQuestionsFields defaultValues={job.status === 'rejected' ? job : undefined} onChange={setAnswers} />

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Notes for Plot360</label>
            <textarea
              className="input"
              name="observations"
              rows={3}
              required
              placeholder="Access issues, discrepancies, anything else the reviewer should know"
              defaultValue={job.status === 'rejected' ? job.observations ?? '' : ''}
            />
          </div>

          <div style={{ border: '1px solid var(--color-divider)', padding: 13, marginBottom: 14 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)', marginBottom: 9 }}>
              Before you submit
            </p>
            {[
              [gatePhotos, `At least ${MIN_PHOTOS} photographs (${photos.length} so far)`],
              [gateSides, `All four boundary sides tagged (${sidesCovered.size} of 4)`],
              [gateVideo, 'At least one video clip'],
              [gateAnswers, `All ten checks answered (${answeredCount} of 10)`],
            ].map(([ok, label]) => (
              <div key={label as string} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 7 }}>
                <span style={{ width: 13, height: 13, marginTop: 2, flexShrink: 0, border: `1px solid ${ok ? 'var(--color-text)' : 'var(--p-ink-muted)'}`, background: ok ? 'var(--color-accent)' : 'transparent' }} />
                <span style={{ fontSize: 12, color: ok ? 'var(--color-text)' : 'var(--p-ink-muted)' }}>{label as string}</span>
              </div>
            ))}
          </div>

          {submitError && <p style={{ color: 'var(--p-alert)', fontSize: 13, marginBottom: 12 }}>{submitError}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={!ready || submitPending} style={{ minHeight: 48 }}>
            {submitPending ? 'Submitting…' : ready ? 'Submit for review' : 'Finish the list above to submit'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--p-ink-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
            Once submitted, this link closes and a reviewer takes over.
          </p>
        </form>
      )}

      {job.status === 'submitted' && !canEdit && (
        <div style={{ padding: '0 20px', maxWidth: 480, margin: '20px auto 0' }}>
          <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)' }}>Submitted — waiting for admin review.</p>
        </div>
      )}
      {(job.status === 'approved' || job.status === 'ec_pending') && (
        <div style={{ padding: '0 20px', maxWidth: 480, margin: '20px auto 0' }}>
          <span className="tag tag-accent">Completed</span>
          <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)', marginTop: 12 }}>
            This job is approved and locked — no further changes can be made.
          </p>
        </div>
      )}
    </div>
  );
}
