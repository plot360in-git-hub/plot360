'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAgentStatus } from './agents.actions';

export function AgentDecisionButtons({ agentId, currentStatus }: { agentId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const router = useRouter();

  function decide(status: 'verified' | 'rejected') {
    setError(null);
    startTransition(async () => {
      const result = await setAgentStatus(agentId, status, notes);
      if (result?.error) setError(result.error);
      else router.push('/admin/agents');
    });
  }

  if (currentStatus !== 'pending') {
    return <span className={`status-pill ${currentStatus}`}>Already {currentStatus}</span>;
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Notes (shown to agent if rejected)</label>
        <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" disabled={isPending} onClick={() => decide('verified')}>
          {isPending ? 'Saving…' : 'Verify agent'}
        </button>
        <button
          className="btn-secondary"
          disabled={isPending}
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          onClick={() => decide('rejected')}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
