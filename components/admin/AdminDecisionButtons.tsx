'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPropertyStatus, deleteProperty } from './admin.actions';

export function AdminDecisionButtons({ propertyId, currentStatus }: { propertyId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();

  function decide(status: 'verified' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const result = await setPropertyStatus(propertyId, status);
      if (result?.error) setError(result.error);
      else router.push('/admin');
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProperty(propertyId);
      if (result?.error) setError(result.error);
      else router.push('/admin');
    });
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {currentStatus === 'pending' ? (
            <>
              <button className="btn-primary" disabled={isPending} onClick={() => decide('verified')}>
                {isPending ? 'Saving…' : 'Verify property'}
              </button>
              <button
                className="btn-secondary"
                disabled={isPending}
                style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                onClick={() => decide('rejected')}
              >
                Reject
              </button>
            </>
          ) : (
            <p className={`status-pill ${currentStatus}`} style={{ display: 'inline-block' }}>Already {currentStatus}</p>
          )}
        </div>

        {!confirmingDelete ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete property
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--color-danger)' }}>Delete permanently?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              style={{
                background: 'var(--color-danger)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-button)',
                padding: '10px 20px',
                cursor: 'pointer',
              }}
            >
              {isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="btn-primary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
