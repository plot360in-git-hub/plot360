'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadEcDigitalCopy } from './monitoring.actions';

// Redesign 2026-09 — .p360-styled EC upload, used on the Submission
// review screen. components/admin/EcUploadForm.tsx (old global
// classnames) is kept intact and still used on the pre-redesign admin
// property page.
export function EcUploadFormP360({ propertyId, uploaded }: { propertyId: string; uploaded: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await uploadEcDigitalCopy(propertyId, formData);
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
