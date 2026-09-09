'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPropertyStatus, deleteProperty } from './admin.actions';

export function AdminDecisionButtons({ propertyId, currentStatus }: { propertyId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const router = useRouter();

  function decide(status: 'verified' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const result = await setPropertyStatus(propertyId, status, status === 'rejected' ? rejectionReason : undefined);
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

      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {currentStatus === 'pending' ? (
            <>
              <button className="btn-primary" disabled={isPending} onClick={() => decide('verified')} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                {isPending ? 'Saving…' : 'Verify property'}
              </button>
              {!rejecting ? (
                <button
                  className="btn-secondary"
                  disabled={isPending}
                  style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={() => setRejecting(true)}
                >
                  Reject
                </button>
              ) : (
                <div style={{ maxWidth: 480, width: '100%' }}>
                  <label className="field-label">
                    Reason for rejection<span style={{ color: 'var(--color-danger)' }}> *</span>
                  </label>
                  <textarea
                    className="field-input"
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain what's wrong and what the customer needs to fix or re-upload."
                    style={{ marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      className="btn-secondary"
                      style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', flexShrink: 0, whiteSpace: 'nowrap' }}
                      disabled={isPending || !rejectionReason.trim()}
                      onClick={() => decide('rejected')}
                    >
                      {isPending ? 'Rejecting…' : 'Confirm rejection'}
                    </button>
                    <button className="btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => { setRejecting(false); setRejectionReason(''); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className={`status-pill ${currentStatus}`} style={{ display: 'inline-block' }}>Already {currentStatus}</p>
          )}
        </div>

        {!confirmingDelete ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete property
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" className="btn-primary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
