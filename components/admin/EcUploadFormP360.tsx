'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadEcDigitalCopy, createEcDigitalCopyUploadUrl } from './monitoring.actions';
import { uploadFilesDirect } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';

// Redesign 2026-09 — .p360-styled EC upload, used on the Submission
// review screen. components/admin/EcUploadForm.tsx (old global
// classnames) is kept intact and still used on the pre-redesign admin
// property page.
export function EcUploadFormP360({ propertyId, uploaded }: { propertyId: string; uploaded: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redesign 2026-09 (follow-up) — uploads straight to storage instead of
  // through a Server Action, which on Vercel has a hard 4.5MB
  // request-body limit that a scanned EC PDF can exceed. See
  // lib/uploadDirect.ts and ARCHITECTURE.md #60.
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
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
        })
      }
      style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--color-divider)', padding: '11px 12px', marginTop: 9 }}
    >
      <div style={{ width: 34, height: 34, background: 'var(--color-neutral-300)', flex: 'none' }} />
      <div style={{ flex: 1, fontSize: 11.5, lineHeight: 1.4 }}>
        {uploaded ? 'Uploaded.' : 'Requested at registration. Attach before sending the report.'}
        {error && <div style={{ color: 'var(--p-alert)', marginTop: 4 }}>{error}</div>}
      </div>
      <input type="file" name="ec_digital_copy" accept="image/*,.pdf" style={{ maxWidth: 130, fontSize: 10.5 }} />
      <button type="submit" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11, flex: 'none' }} disabled={pending}>
        {pending ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
      </button>
    </form>
  );
}
