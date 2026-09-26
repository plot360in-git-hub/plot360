'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadEcDigitalCopy, createEcDigitalCopyUploadUrl } from './monitoring.actions';
import { uploadFilesDirect } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';

export function EcUploadForm({ propertyId, existingDoc }: { propertyId: string; existingDoc?: { name: string; url: string | null } | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redesign 2026-09 (follow-up) — uploads straight to storage instead of
  // through a Server Action, which on Vercel has a hard 4.5MB
  // request-body limit that a scanned EC PDF can exceed. See
  // lib/uploadDirect.ts and ARCHITECTURE.md #60.
  function handleSubmit(formData: FormData) {
    setError(null);
    const file = formData.get('ec_digital_copy') as File | null;
    if (!file || file.size === 0) {
      setError('Please choose a file to upload.');
      return;
    }
    const oversized = findOversizedFiles([file]);
    if (oversized.length > 0) {
      setError(oversizedFilesMessage(oversized));
      return;
    }
    startTransition(async () => {
      const urlResult = await createEcDigitalCopyUploadUrl(propertyId, file.name);
      if (urlResult?.error || !urlResult?.path || !urlResult?.token || !urlResult?.bucket) {
        setError(urlResult?.error ?? 'Could not prepare the upload — check your connection and try again.');
        return;
      }
      const results = await uploadFilesDirect(urlResult.bucket, [{ path: urlResult.path, token: urlResult.token, file }]);
      if (!results[0]?.ok) {
        setError('Upload failed — check your connection and try again.');
        return;
      }
      const result = await uploadEcDigitalCopy(propertyId, urlResult.path);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ marginBottom: 24, borderColor: 'var(--color-pending)' }}>
      <h3 style={{ marginBottom: 8 }}>Digital Encumbrance Certificate</h3>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        This customer requested a Digital Signed EC copy. Upload it here once received — any
        monitoring job waiting on this will close automatically.
      </p>
      {existingDoc && (
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          Currently uploaded:{' '}
          {existingDoc.url ? (
            <a href={existingDoc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>{existingDoc.name}</a>
          ) : (
            existingDoc.name
          )}
        </p>
      )}
      <input className="field-input" type="file" name="ec_digital_copy" accept="image/*,.pdf" style={{ marginBottom: 12 }} />
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Uploading…' : existingDoc ? 'Replace EC document' : 'Upload EC document'}
      </button>
    </form>
  );
}
