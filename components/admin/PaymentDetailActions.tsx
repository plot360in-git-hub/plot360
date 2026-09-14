'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmPaymentWithLog, flagPaymentMismatchWithLog } from './review-decisions.actions';
import { RejectionDialog } from './RejectionDialog';

export function PaymentDetailActions({
  paymentId,
  propertyId,
  defaultAmount,
  defaultReference,
}: {
  paymentId: string;
  propertyId: string;
  defaultAmount: number | null;
  defaultReference?: string | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : '');
  // Kept even though the design's own mock only shows the amount field —
  // components/admin/PaymentRecordForm.tsx (the pre-redesign confirm
  // form) lets the admin record the bank reference too, and dropping it
  // here would silently lose that capability with no other way to set it.
  const [reference, setReference] = useState(defaultReference ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="field" style={{ marginTop: 16 }}>
        <label>Amount received in the account</label>
        <input className="input" style={{ minHeight: 38 }} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Bank reference (optional)</label>
        <input className="input" style={{ minHeight: 38 }} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NEFT/UTR number from your bank statement" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '2px solid var(--color-divider)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const formData = new FormData();
              formData.set('payment_method', 'Bank transfer');
              formData.set('amount', amount);
              formData.set('transaction_reference', reference);
              const result = await confirmPaymentWithLog(paymentId, propertyId, formData);
              if ('error' in result) setError(result.error);
              else router.push('/admin/queue/payments');
            })
          }
        >
          Confirm payment and release credits
        </button>

        <RejectionDialog
          triggerLabel="Flag a mismatch"
          title="Flag a mismatch with the customer"
          note="Pick what does not match. The customer gets this on WhatsApp; credits stay on hold."
          recipientLabel="WhatsApp to the customer"
          placeholder="Sent verbatim to the customer"
          cta="Send and hold"
          reasons={['Amount received is less than the plan price', 'No transfer found against this reference', 'Reference number does not match our records', 'Transfer appears to be a duplicate']}
          messagePrefix="Plot360: We have a question about your bank transfer. "
          messageSuffix=" Reply here with the transfer receipt and we will release your visit credits."
          onSubmit={async (reasonText) => {
            const result = await flagPaymentMismatchWithLog(paymentId, reasonText);
            if (!('error' in result)) router.push('/admin/queue/payments');
            return result;
          }}
        />
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 9 }}>{error}</p>}
      <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 9 }}>Confirming sends the customer a WhatsApp and moves the visit into job assignment. UPI payments never reach this queue.</p>
    </div>
  );
}
