'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideMonitoringJob, getRejectionWhatsAppDetails } from './monitoring.actions';
import { buildWhatsAppLink, buildCompletionMessage, buildRejectionMessage } from './whatsapp';

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
  const [adminRemarks, setAdminRemarks] = useState('');
  const [waLink, setWaLink] = useState<string | null>(null);
  const [rejectedWaLink, setRejectedWaLink] = useState<string | null>(null);
  const [ecPending, setEcPending] = useState(false);
  const router = useRouter();

  function handleDecision(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !feedback.trim()) {
      setError('Please add feedback so the agent knows what to fix.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await decideMonitoringJob(jobId, propertyId, decision, feedback, adminRemarks);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (decision === 'approved' && result?.ecPending) {
        setEcPending(true);
        return;
      }
      if (decision === 'approved') {
        setWaLink(buildWhatsAppLink(agentPhoneCountryCode, agentPhoneNumber, buildCompletionMessage(propertyName)));
        return;
      }

      // Rejected — pull a fresh (or reused, if still valid) upload link
      // and prepare the "please fix and re-upload" WhatsApp message.
      const details = await getRejectionWhatsAppDetails(jobId);
      if ('error' in details) {
        router.push('/admin/monitoring');
        return;
      }
      setRejectedWaLink(
        buildWhatsAppLink(
          agentPhoneCountryCode,
          agentPhoneNumber,
          buildRejectionMessage({ propertyName: details.propertyName!, feedback: details.feedback!, uploadLink: details.uploadLink! })
        )
      );
    });
  }

  if (ecPending) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-pending)', marginBottom: 12 }}>
          Visit approved — photos/videos released to the customer. This property requested a
          Digital EC copy, though, so the job stays open until that's uploaded from the property's
          admin page.
        </p>
        <a
          href={buildWhatsAppLink(agentPhoneCountryCode, agentPhoneNumber, buildCompletionMessage(propertyName))}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}
        >
          Send approval message via WhatsApp
        </a>
        <div>
          <button className="btn-secondary" onClick={() => router.push(`/admin/${propertyId}`)} style={{ marginRight: 8 }}>
            Go upload the EC now
          </button>
          <button className="btn-primary" onClick={() => router.push('/admin/monitoring')}>Back to monitoring</button>
        </div>
      </div>
    );
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

  if (rejectedWaLink) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>Sent back to agent — needs changes.</p>
        <a href={rejectedWaLink} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>
          Send feedback + re-upload link via WhatsApp
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
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Remarks (optional — shown on the customer's visit report if approving)</label>
        <textarea className="field-input" rows={2} value={adminRemarks} onChange={(e) => setAdminRemarks(e.target.value)} />
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
