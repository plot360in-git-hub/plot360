'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveSubmission, rejectSubmission } from './review-decisions.actions';
import { RejectionDialog } from './RejectionDialog';
import { buildWhatsAppLink } from './whatsapp';

// Redesign 2026-09 — admin console, Submission review screen's
// "Comments for the customer's report" + Approve/Reject row.
//
// Redesign 2026-09 (follow-up) — approveSubmission/rejectSubmission used
// to log the WhatsApp and route away with nothing ever opening it. Same
// "Send via WhatsApp / Done" panel fix as PropertyVerificationActions.tsx.
export function SubmissionReviewActions({ jobId, propertyId, propertyName }: { jobId: string; propertyId: string; propertyName: string }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  if (waLink) {
    return (
      <div style={{ marginTop: 20, paddingTop: 18, borderTop: '2px solid var(--color-divider)' }}>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginBottom: 10 }}>Saved. Now send the WhatsApp:</p>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px', textDecoration: 'none', display: 'inline-flex' }}>
          Send via WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px', marginLeft: 10 }}
          onClick={() => router.push('/admin/queue/agent-submissions')}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginTop: 8 }}>
        <div className="field">
          <label>Comments for the customer's report</label>
          <textarea
            className="input"
            style={{ minHeight: 74, resize: 'none', lineHeight: 1.5 }}
            placeholder='Appears in the report under "Note from Plot360"'
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 18, borderTop: '2px solid var(--color-divider)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await approveSubmission(jobId, propertyId, remarks);
              if ('error' in result) setError(result.error);
              else if ('phoneNumber' in result && result.phoneNumber) setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message));
              else router.push('/admin/queue/agent-submissions');
            })
          }
        >
          Approve and send the report
        </button>

        <RejectionDialog
          triggerLabel="Reject and reassign to the same agent"
          title="Send this visit back to the agent"
          note="Pick what needs redoing. The agent gets this on WhatsApp with a fresh upload link valid 7 days."
          recipientLabel="WhatsApp to the agent"
          placeholder="Sent verbatim to the agent"
          cta="Reject and reassign"
          reasons={[
            'Photos are of the wrong plot or an adjoining one',
            'Boundary sides are not all covered',
            'Photos are blurred, dark or too few',
            'Answers do not match what the photos show',
          ]}
          messagePrefix={`Plot360: Your visit submission for ${propertyName} needs rework. `}
          messageSuffix=" New upload link sent separately (valid 7 days). The job stays with you."
          onSubmit={async (reasonText) => {
            const result = await rejectSubmission(jobId, propertyId, reasonText);
            if ('error' in result) return result;
            if ('phoneNumber' in result && result.phoneNumber) setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message));
            else router.push('/admin/queue/agent-submissions');
            return { success: true };
          }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 9 }}>{error}</p>}
      <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 9 }}>
        Rejecting sends the agent a WhatsApp with a fresh upload link for the same job; approving releases the report and its photographs to the customer.
      </p>
    </div>
  );
}
