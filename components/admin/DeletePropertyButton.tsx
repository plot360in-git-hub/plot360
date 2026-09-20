'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProperty } from './admin.actions';

// Redesign 2026-09 — admin console. The design's own Property
// verification mock has no delete affordance, but the pre-redesign
// AdminDecisionButtons.tsx (now unreferenced) did — and with that
// component no longer wired into any route, deleting a mis-created
// registration (e.g. a duplicate from the quick-registration flow)
// would otherwise have no UI path at all. Kept as a small, two-step,
// clearly de-emphasized link rather than dropping the capability
// silently.
export function DeletePropertyButton({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--p-ink-soft)' }} onClick={() => setConfirming(true)}>
        Delete this property…
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11.5, color: 'var(--p-alert)' }}>This permanently removes the property, its documents and job history. This cannot be undone.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: 11, color: 'var(--p-alert)' }}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteProperty(propertyId);
              if (result && 'error' in result) setError(result.error ?? null);
              else router.push('/admin/queue/property-verification');
            })
          }
        >
          {pending ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--p-alert)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
