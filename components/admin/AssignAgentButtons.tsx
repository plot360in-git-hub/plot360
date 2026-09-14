'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignAgentToTarget } from './assignment.actions';

export function AssignAgentButtons({
  kind,
  targetId,
  agentId,
  label,
  primary,
}: {
  kind: 'legacy' | 'visit_request' | 'stuck';
  targetId: string;
  agentId: string;
  label: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ flex: 'none' }}>
      <button
        type="button"
        className={primary ? 'btn btn-primary' : 'btn btn-secondary'}
        style={{ minHeight: primary ? 32 : 30, fontSize: primary ? 11.5 : 11, padding: primary ? '0 12px' : '0 11px' }}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await assignAgentToTarget(kind, targetId, agentId);
            if ('error' in result) setError(result.error);
            else router.push('/admin/queue/job-assignment');
          })
        }
      >
        {pending ? 'Assigning…' : label}
      </button>
      {error && <p style={{ fontSize: 10.5, color: 'var(--p-alert)', marginTop: 4, maxWidth: 200 }}>{error}</p>}
    </div>
  );
}
