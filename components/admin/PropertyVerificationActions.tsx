'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyProperty, rejectPropertyVerification } from './review-decisions.actions';
import { RejectionDialog } from './RejectionDialog';
import { buildWhatsAppLink } from './whatsapp';

// Redesign 2026-09 — admin console, Property verification detail
// screen's Approve/Reject row, including the "I have checked this ID
// still matches" confirmation the design requires before Approve is
// enabled.
//
// Redesign 2026-09 (follow-up) — verifyProperty used to log the "you're
// verified" WhatsApp and route straight to the queue with nothing ever
// opening WhatsApp. Now shows a "Send via WhatsApp" link first (same
// shape MonitoringDecision.tsx/AssignAgentForm.tsx already use for their
// own post-decision WhatsApp), and only navigates away once the admin
// is done with it — same fix applied to "Reject with reason" via
// RejectionDialog's whatsappLink.
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
  const [waLink, setWaLink] = useState<string | null>(null);

  if (waLink) {
    return (
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '2px solid var(--color-divider)' }}>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginBottom: 10 }}>Saved. Now send the customer their WhatsApp:</p>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px', textDecoration: 'none', display: 'inline-flex' }}>
          Send via WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px', marginLeft: 10 }}
          onClick={() => router.push('/admin/queue/property-verification')}
        >
          Done
        </button>
      </div>
    );
  }

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
              else if ('phoneNumber' in result && result.phoneNumber) setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message));
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
            // Note: sets waLink itself (below) rather than returning
            // whatsappLink for RejectionDialog to auto-open — this
            // screen navigates away on success, and doing that at the
            // same time as an auto window.open risks the tab closing
            // before it opens. Showing the same "Send via WhatsApp /
            // Done" panel the Approve button above uses avoids the race.
            const result = await rejectPropertyVerification(propertyId, reasonText);
            if ('error' in result) return result;
            if ('phoneNumber' in result && result.phoneNumber) setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message));
            else router.push('/admin/queue/property-verification');
            return { success: true };
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
