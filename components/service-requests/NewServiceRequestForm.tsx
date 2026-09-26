'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceRequest, createServiceRequestUploadUrls, recordServiceRequestAttachments, getMyPropertiesForServiceRequest } from './service-requests.actions';
import { uploadFilesDirect } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';

export function NewServiceRequestForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<{ id: string; property_name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    getMyPropertiesForServiceRequest().then(setProperties);
  }, []);

  // Redesign 2026-09 (follow-up) — attachments now upload straight to
  // storage from the browser instead of through a Server Action, which on
  // Vercel has a hard 4.5MB request-body limit. See lib/uploadDirect.ts
  // and ARCHITECTURE.md #60.
  function handleSubmit(formData: FormData) {
    setError(null);
    const files = (formData.getAll('attachments') as File[]).filter((f) => f.size > 0);
    const oversized = findOversizedFiles(files);
    if (oversized.length > 0) {
      setError(oversizedFilesMessage(oversized));
      return;
    }
    startTransition(async () => {
      const result = await createServiceRequest(formData);
      if (result?.error || !result?.requestId) {
        setError(result?.error ?? 'Something went wrong.');
        return;
      }

      if (files.length > 0) {
        const urlResult = await createServiceRequestUploadUrls(result.requestId, files.map((f) => f.name));
        if (urlResult?.error || !urlResult?.uploads || !urlResult.bucket) {
          setError(`Request submitted, but attachments failed to upload: ${urlResult?.error ?? 'unknown error'}`);
          router.push(`/service-requests/${result.requestId}`);
          return;
        }
        const uploads = urlResult.uploads;
        const results = await uploadFilesDirect(
          urlResult.bucket,
          uploads.map((u, i) => ({ path: u.path, token: u.token, file: files[i] }))
        );
        const succeeded = results.filter((r) => r.ok);
        if (succeeded.length > 0) {
          await recordServiceRequestAttachments(result.messageId!, succeeded.map((r) => uploads[r.index].path));
        }
      }

      router.push(`/service-requests/${result.requestId}`);
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>New Service Request</h2>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Subject<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" name="subject" required />
      </div>

      {properties.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Related property (optional)</label>
          <select className="field-input" name="property_id" defaultValue="">
            <option value="">None</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Describe your issue or request<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <textarea className="field-input" name="description" rows={5} required />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Attach files (optional)</label>
        <input className="field-input" type="file" name="attachments" multiple />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
