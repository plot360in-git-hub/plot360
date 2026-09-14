'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyProperty, rejectPropertyVerification } from './review-decisions.actions';
import { RejectionDialog } from './RejectionDialog';

// Redesign 2026-09 — admin console, Property verification detail
// screen's Approve/Reject row, including the "I have checked this ID
// still matches" confirmation the design requires before Approve is
// enabled.
export function PropertyVerificationActions({
  propertyId,
  propertyName,
  hasIdProof,
}: {
  propertyId: string;
  propertyName: string;
  hasIdProof: boolean;
}) {
  const router = useRouter();
  const [idConfirmed, setIdConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {hasIdProof && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5, lineHeight: 1.4, marginTop: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={idConfirmed} onChange={(e) => setIdConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 16, height: 16 }} />
          <span>
            I have checked this ID still matches the ownership document <span style={{ color: 'var(--color-accent)' }}>*</span>
          </span>
        </label>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '2px solid var(--color-divider)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }}
          disabled={pending || (hasIdProof && !idConfirmed)}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await verifyProperty(propertyId);
              if ('error' in result) setError(result.error);
              else router.push('/admin/queue/property-verification');
            })
          }
        >
          Approve and mark verified
        </button>

        <RejectionDialog
          triggerLabel="Reject with reason"
          title="Reject and tell the customer why"
          note="Pick a reason. It is sent to the customer on WhatsApp exactly as written below."
          recipientLabel="WhatsApp to the customer"
          placeholder="Sent verbatim to the customer"
          cta="Send and reject"
          reasons={[
            'Ownership proof is missing or unreadable',
            'ID proof does not match the ownership document',
            "Owner's approval letter is needed (the customer is not the owner)",
            'Site location or SRO details are incomplete',
          ]}
          messagePrefix={`Plot360: We could not complete verification for ${propertyName}. `}
          messageSuffix=" Reply here with the document and we will continue — your plan and visit credits are unaffected."
          onSubmit={async (reasonText) => {
            const result = await rejectPropertyVerification(propertyId, reasonText);
            if (!('error' in result)) router.push('/admin/queue/property-verification');
            return result;
          }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 9 }}>{error}</p>}
      {!error && (
        <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 9 }}>
          {hasIdProof && !idConfirmed
            ? 'Confirm the ID proof still matches the ownership document before approving.'
            : 'Approving marks the property verified and sends the customer a WhatsApp. The visit then moves to job assignment.'}
        </p>
      )}
    </div>
  );
}
