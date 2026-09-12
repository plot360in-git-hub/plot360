'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteMonitoringJob } from './monitoring.actions';
import { profileDisplayName } from './displayName';

const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  ec_pending: 'pending',
  rejected: 'rejected',
};

export function MonitoringJobHistoryAdmin({ jobs }: { jobs: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (jobs.length === 0) return null;

  function handleDelete(jobId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteMonitoringJob(jobId);
      if (result?.error) setError(result.error);
      else router.refresh();
      setConfirmingId(null);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ marginBottom: 4 }}>Monitoring Job History</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Every job ever created for this property. If a stray/duplicate one is here by mistake, remove it below.
      </p>
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {jobs.map((j) => (
          <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <div>
              <span className={`status-pill ${STATUS_CLASS[j.status] ?? 'pending'}`} style={{ marginRight: 10 }}>
                {j.status}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {profileDisplayName(j.agent_profiles?.profiles)} · assigned {j.assigned_at?.slice(0, 10)}
                {j.decided_at ? ` · decided ${j.decided_at.slice(0, 10)}` : ''}
              </span>
            </div>
            {j.status !== 'submitted' && (
              confirmingId === j.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Delete this job permanently?</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(j.id)}
                    style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-button)', padding: '4px 14px', fontSize: 12, cursor: 'pointer' }}
                  >
                    {isPending ? '…' : 'Yes, delete'}
                  </button>
                  <button type="button" className="btn-primary" style={{ padding: '4px 14px', fontSize: 12 }} onClick={() => setConfirmingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '4px 14px', fontSize: 12, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => setConfirmingId(j.id)}
                >
                  Delete
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
