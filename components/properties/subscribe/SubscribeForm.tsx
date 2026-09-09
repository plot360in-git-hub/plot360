'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSubscriptionPayment } from './subscribe.actions';

export function SubscribeForm({
  propertyId,
  plans,
  paymentSettings,
  qrUrl,
  pendingPayment,
}: {
  propertyId: string;
  plans: any[];
  paymentSettings: any;
  qrUrl: string | null;
  pendingPayment: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState(pendingPayment?.plan_id ?? '');
  const [method, setMethod] = useState(pendingPayment?.payment_method ?? '');
  const router = useRouter();

  if (pendingPayment?.transaction_reference) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <span className="status-pill pending" style={{ marginBottom: 16, display: 'inline-block' }}>Awaiting confirmation</span>
        <p style={{ marginBottom: 8 }}>
          You've submitted <strong>{pendingPayment.subscription_plans?.name}</strong> (₹{pendingPayment.subscription_plans?.price})
          via {pendingPayment.payment_method}.
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          Transaction ID: {pendingPayment.transaction_reference}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 12 }}>
          An admin will verify this and confirm your subscription shortly.
        </p>
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitSubscriptionPayment(propertyId, formData);
      if (result?.error) setError(result.error);
      else router.push('/dashboard');
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>Subscribe</h2>

      <label className="field-label" style={{ marginBottom: 12, display: 'block' }}>
        Choose a plan<span style={{ color: 'var(--color-danger)' }}> *</span>
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {plans.map((p) => (
          <label
            key={p.id}
            className="card section-alt"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
              borderColor: planId === p.id ? 'var(--color-accent)' : undefined,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="radio" name="plan_id" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} required />
              <span>{p.name} <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>({p.validity_months} months)</span></span>
            </span>
            <strong>₹{p.price}</strong>
          </label>
        ))}
      </div>

      <label className="field-label" style={{ marginBottom: 12, display: 'block' }}>
        How will you pay?<span style={{ color: 'var(--color-danger)' }}> *</span>
      </label>
      <select className="field-input" name="payment_method" required value={method} onChange={(e) => setMethod(e.target.value)} style={{ marginBottom: 16 }}>
        <option value="" disabled>Select…</option>
        <option value="UPI">UPI</option>
        <option value="Bank Transfer">Bank Transfer</option>
        <option value="QR Code">QR Code</option>
        <option value="Other">Other</option>
      </select>

      {(method === 'UPI' || method === 'QR Code') && paymentSettings?.upi_id && (
        <div className="card section-alt" style={{ marginBottom: 16 }}>
          <p className="field-label" style={{ marginBottom: 4 }}>UPI ID</p>
          <p style={{ fontSize: 15 }}>{paymentSettings.upi_id}</p>
        </div>
      )}
      {method === 'QR Code' && qrUrl && (
        <div className="card section-alt" style={{ marginBottom: 16, textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="Payment QR code" style={{ maxWidth: 220, margin: '0 auto' }} />
        </div>
      )}
      {method === 'Bank Transfer' && paymentSettings && (
        <div className="card section-alt" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, marginBottom: 4 }}>Account Name: {paymentSettings.bank_account_name}</p>
          <p style={{ fontSize: 14, marginBottom: 4 }}>Account Number: {paymentSettings.bank_account_number}</p>
          <p style={{ fontSize: 14, marginBottom: 4 }}>IFSC: {paymentSettings.bank_ifsc}</p>
          <p style={{ fontSize: 14 }}>Bank: {paymentSettings.bank_name}</p>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Transaction ID<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" name="transaction_id" required placeholder="Reference number from your payment app/bank" />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Payment screenshot (optional)</label>
        <input className="field-input" type="file" name="screenshot" accept="image/*" />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit for verification'}
      </button>
    </form>
  );
}
