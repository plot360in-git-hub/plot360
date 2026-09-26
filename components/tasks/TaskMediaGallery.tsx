'use client';

import { useState, useTransition } from 'react';
import { createTaskMediaUploadUrls, recordTaskMedia, updateTaskStatus } from './tasks.actions';
import { uploadFilesDirect, mediaTypeOf } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';
import type { Task, TaskMedia } from '@/types/database.types';

const SUPABASE_STORAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

function mediaUrl(bucket: string, path: string) {
  return `${SUPABASE_STORAGE_URL}/${bucket}/${path}`;
}

const STATUS_LABEL: Record<string, string> = {
  not_done: 'Not Done',
  in_progress: 'In Progress',
  complete: 'Complete',
};

export function TaskMediaGallery({
  task,
  media,
  readOnly = false,
}: {
  task: Task & { properties?: { property_name: string } };
  media: TaskMedia[];
  readOnly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const photos = media.filter((m) => m.media_type === 'photo');
  const videos = media.filter((m) => m.media_type === 'video');

  // Redesign 2026-09 (follow-up) — uploads now go browser → Supabase
  // Storage directly instead of through a Server Action, which on Vercel
  // has a hard 4.5MB request-body limit that real phone photos/video
  // routinely exceed. See lib/uploadDirect.ts and ARCHITECTURE.md #60.
  function handleUpload(formData: FormData) {
    setError(null);
    const files = (formData.getAll('media') as File[]).filter((f) => f.size > 0);
    if (files.length === 0) {
      setError('No files selected.');
      return;
    }
    const oversized = findOversizedFiles(files);
    if (oversized.length > 0) {
      setError(oversizedFilesMessage(oversized));
      return;
    }
    startTransition(async () => {
      const urlResult = await createTaskMediaUploadUrls(task.id, files.map((f) => f.name));
      if (urlResult?.error || !urlResult?.uploads || !urlResult.bucket) {
        setError(urlResult?.error ?? 'Could not prepare the upload — check your connection and try again.');
        return;
      }
      const uploads = urlResult.uploads;
      const results = await uploadFilesDirect(
        urlResult.bucket,
        uploads.map((u, i) => ({ path: u.path, token: u.token, file: files[i] }))
      );
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);

      if (succeeded.length > 0) {
        const items = succeeded.map((r) => ({ path: uploads[r.index].path, mediaType: mediaTypeOf(files[r.index]) }));
        const result = await recordTaskMedia(task.id, items);
        if (result?.error) {
          setError(result.error);
          return;
        }
      }
      if (failed.length > 0) {
        setError(
          `${failed.length} of ${files.length} file${files.length === 1 ? '' : 's'} failed to upload${
            succeeded.length ? ` (${succeeded.length} saved)` : ''
          } — check your connection and try again.`
        );
      }
    });
  }

  function handleStatusChange(status: 'not_done' | 'in_progress' | 'complete') {
    startTransition(() => {
      updateTaskStatus(task.id, status);
    });
  }

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h2 style={{ marginBottom: 4 }}>{task.task_name}</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>{task.properties?.property_name}</p>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Status</label>
        {readOnly ? (
          <p style={{ fontSize: 17 }}>{STATUS_LABEL[task.status] ?? task.status}</p>
        ) : (
          <select
            className="field-input"
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as any)}
            style={{ maxWidth: 220 }}
          >
            <option value="not_done">Not Done</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
        )}
      </div>

      {task.notes && (
        <div style={{ marginBottom: 24 }}>
          <p className="field-label">Notes</p>
          <p>{task.notes}</p>
        </div>
      )}

      <h4 style={{ marginBottom: 12 }}>Task media</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={mediaUrl('task-media', p.file_path)}
            alt=""
            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-input)' }}
          />
        ))}
        {photos.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No photos uploaded yet.</p>}
      </div>

      {videos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <video controls style={{ width: '100%', borderRadius: 'var(--radius-input)' }}>
            <source src={mediaUrl('task-media', videos[0].file_path)} />
          </video>
        </div>
      )}

      {!readOnly && (
        <form action={handleUpload} className="card" style={{ marginBottom: 24 }}>
          <label className="field-label">Upload photos / video</label>
          <input className="field-input" type="file" name="media" accept="image/*,video/*" multiple style={{ marginBottom: 12 }} />
          {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={isPending}>
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
    </div>
  );
}
