'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideMonitoringJob } from './monitoring.actions';
import { buildWhatsAppLink, buildCompletionMessage } from './whatsapp';

export function MonitoringDecision({
  jobId,
  propertyId,
  propertyName,
  agentPhoneCountryCode,
  agentPhoneNumber,
}: {
  jobId: string;
  propertyId: string;
  propertyName: string;
  agentPhoneCountryCode?: string | null;
  agentPhoneNumber?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [waLink, setWaLink] = useState<string | null>(null);
  const router = useRouter();

  function handleDecision(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !feedback.trim()) {
      setError('Please add feedback so the agent knows what to fix.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await decideMonitoringJob(jobId, propertyId, decision, feedback);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (decision === 'approved') {
        setWaLink(buildWhatsAppLink(agentPhoneCountryCode, agentPhoneNumber, buildCompletionMessage(propertyName)));
      } else {
        router.push('/admin/monitoring');
      }
    });
  }

  if (waLink) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-success)', marginBottom: 12 }}>Approved — job complete and locked.</p>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
          Send completion message via WhatsApp
        </a>
        <div>
          <button className="btn-secondary" onClick={() => router.push('/admin/monitoring')}>Back to monitoring</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Decision</h3>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Feedback / questions for the agent (required if rejecting)</label>
        <textarea className="field-input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" disabled={isPending} onClick={() => handleDecision('approved')}>
          {isPending ? 'Saving…' : 'Approve — job complete'}
        </button>
        <button
          className="btn-secondary"
          disabled={isPending}
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          onClick={() => handleDecision('rejected')}
        >
          Reject — send back to agent
        </button>
      </div>
    </div>
  );
}
