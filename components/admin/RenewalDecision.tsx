'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideRenewal } from '@/components/properties/renewal/renewal.actions';

export function RenewalDecision({
  requestId,
  propertyId,
}: {
  requestId: string;
  propertyId: string;
  requestedDate: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const router = useRouter();

  function handleDecision(decision: 'approved' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const result = await decideRenewal(requestId, propertyId, decision, undefined, notes);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <input
        className="field-input"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" disabled={isPending} onClick={() => handleDecision('approved')}>
          {isPending ? 'Saving…' : 'Approve — send for payment'}
        </button>
        <button
          className="btn-secondary"
          disabled={isPending}
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          onClick={() => handleDecision('rejected')}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
