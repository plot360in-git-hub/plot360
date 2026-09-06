'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordPayment } from '@/components/payments/payments.actions';

export function PaymentRecordForm({ paymentId, propertyId }: { paymentId: string; propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(paymentId, propertyId, formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        Record payment
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="card section-alt">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Payment method<span style={{ color: 'var(--color-danger)' }}> *</span></label>
          <select className="field-input" name="payment_method" required defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="field-label">Amount</label>
          <input className="field-input" type="number" step="0.01" name="amount" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Transaction / reference number</label>
          <input className="field-input" name="transaction_reference" />
        </div>
        <div>
          <label className="field-label">Date received</label>
          <input className="field-input" type="date" name="paid_at" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Notes</label>
        <textarea className="field-input" name="notes" rows={2} placeholder="Any other details useful for payment history" />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Confirm payment received'}
        </button>
        <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
