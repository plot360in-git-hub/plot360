'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleUserBan } from './users.actions';

export function UserBanToggle({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserBan(userId, !isBanned);
      if (result?.error) setError(result.error);
      else router.refresh();
      setConfirming(false);
    });
  }

  if (isBanned) {
    return (
      <button className="btn-primary" disabled={isPending} onClick={handleToggle} style={{ padding: '6px 16px', fontSize: 13 }}>
        {isPending ? 'Enabling…' : 'Enable login'}
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        className="btn-secondary"
        style={{ padding: '6px 16px', fontSize: 13, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
        onClick={() => setConfirming(true)}
      >
        Disable login
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</span>}
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sure?</span>
      <button
        disabled={isPending}
        onClick={handleToggle}
        style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-button)', padding: '6px 16px', fontSize: 13, cursor: 'pointer' }}
      >
        {isPending ? 'Disabling…' : 'Yes'}
      </button>
      <button className="btn-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </div>
  );
}
