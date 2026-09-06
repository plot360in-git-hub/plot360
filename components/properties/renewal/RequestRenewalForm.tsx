'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { requestRenewal } from './renewal.actions';

function defaultRequestedDate(currentExpiration: string | null) {
  const base = currentExpiration && new Date(currentExpiration) > new Date() ? new Date(currentExpiration) : new Date();
  base.setFullYear(base.getFullYear() + 1);
  return base.toISOString().slice(0, 10);
}

export function RequestRenewalForm({
  propertyId,
  propertyName,
  currentExpiration,
  alreadyPending,
}: {
  propertyId: string;
  propertyName: string;
  currentExpiration: string | null;
  alreadyPending: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestRenewal(propertyId, formData);
      if (result?.error) setError(result.error);
      else setSubmitted(true);
    });
  }

  if (alreadyPending || submitted) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Renewal request pending</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Your renewal request for {propertyName} has been submitted and is awaiting admin approval.
          You'll see the updated expiration date here once it's approved.
        </p>
        <Link href={`/properties/${propertyId}`} className="btn-primary" style={{ textDecoration: 'none' }}>
          Back to property
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h3 style={{ marginBottom: 12 }}>Request renewal for {propertyName}</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 20 }}>
        Current expiration: {currentExpiration ?? '—'}. Submitting this sends a request to an admin —
        the date won't change until it's approved.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label className="field-label">Requested new expiration date</label>
        <input
          className="field-input"
          type="date"
          name="requested_expiration_date"
          required
          defaultValue={defaultRequestedDate(currentExpiration)}
        />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit renewal request'}
        </button>
        <Link href={`/properties/${propertyId}`} className="btn-primary" style={{ textDecoration: 'none' }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
