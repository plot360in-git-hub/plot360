'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadEcDigitalCopy } from './monitoring.actions';

export function EcUploadForm({ propertyId, existingDoc }: { propertyId: string; existingDoc?: { name: string; url: string | null } | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadEcDigitalCopy(propertyId, formData);
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
