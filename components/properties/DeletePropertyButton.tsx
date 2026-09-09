'use client';

import { useState, useTransition } from 'react';
import { deletePropertyPermanently } from './delete.actions';

export function DeletePropertyButton({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePropertyPermanently(propertyId);
      if (result?.error) setError(result.error);
    });
  }

  if (step === 0) {
    return (
      <button
        type="button"
        className="btn-secondary"
        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
        onClick={() => setStep(1)}
      >
        Delete Property
      </button>
    );
  }

  if (step === 1) {
    return (
      <div className="card section-alt" style={{ borderColor: 'var(--color-danger)', maxWidth: 480 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Delete "{propertyName}"?</p>
        <p style={{ fontSize: 14, marginBottom: 16 }}>
          This permanently deletes the property along with every document, photo, video, task,
          payment record, and monitoring visit attached to it. <strong>This cannot be undone —
          nothing can be recovered afterward.</strong>
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn-primary" onClick={() => setStep(0)}>Cancel</button>
          <button
            type="button"
            style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-button)', padding: '10px 24px', cursor: 'pointer' }}
            onClick={() => setStep(2)}
          >
            I understand, continue
          </button>
        </div>
      </div>
    );
  }

  const canConfirm = confirmText.trim() === propertyName;

  return (
    <div className="card section-alt" style={{ borderColor: 'var(--color-danger)', maxWidth: 480 }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Final confirmation</p>
      <p style={{ fontSize: 14, marginBottom: 12 }}>
        Type the property name <strong>{propertyName}</strong> below to confirm permanent deletion.
      </p>
      <input
        className="field-input"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" className="btn-primary" onClick={() => setStep(0)}>Cancel</button>
        <button
          type="button"
          disabled={!canConfirm || isPending}
          style={{
            background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-button)',
            padding: '10px 24px', cursor: canConfirm ? 'pointer' : 'not-allowed', opacity: canConfirm ? 1 : 0.5,
          }}
          onClick={handleDelete}
        >
          {isPending ? 'Deleting…' : 'Permanently delete'}
        </button>
      </div>
    </div>
  );
}
