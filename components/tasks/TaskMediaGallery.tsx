'use client';

import { useState, useTransition } from 'react';
import { uploadTaskMedia, updateTaskStatus } from './tasks.actions';
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

  function handleUpload(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadTaskMedia(task.id, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleStatusChange(status: 'not_done' | 'in_progress' | 'complete') {
    startTransition(() => updateTaskStatus(task.id, status));
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
