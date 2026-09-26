'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSubscriptionPayment, createPaymentScreenshotUploadUrl } from './subscribe.actions';
import { uploadFilesDirect } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';
import { computePlanPrice, effectiveDiscountPercent } from '@/lib/subscription';

function PlanPriceDisplay({ plan, isRenewal }: { plan: any; isRenewal: boolean }) {
  const basePrice = plan.base_price ?? plan.price;
  const discount = effectiveDiscountPercent(plan, isRenewal);
  const finalPrice = computePlanPrice(basePrice, discount);

  if (discount > 0) {
    return (
      <span>
        <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', marginRight: 8, fontSize: 13 }}>
          ₹{basePrice}
        </span>
        <span style={{ background: '#fbe9d0', color: '#8a5a10', borderRadius: 6, padding: '1px 6px', fontSize: 12, marginRight: 8 }}>
          {discount}% off
        </span>
        <strong>₹{finalPrice}</strong>
      </span>
    );
  }
  return <strong>₹{finalPrice}</strong>;
}

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

  const isRenewal = pendingPayment?.payment_type === 'renewal';

  if (pendingPayment?.transaction_reference) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <span className="status-pill pending" style={{ marginBottom: 16, display: 'inline-block' }}>Awaiting confirmation</span>
        <p style={{ marginBottom: 8 }}>
          You've submitted <strong>{pendingPayment.subscription_plans?.name}</strong> via {pendingPayment.payment_method}.
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

  // Redesign 2026-09 (follow-up) — the payment screenshot now uploads
  // straight to storage instead of through this Server Action, which on
  // Vercel has a hard 4.5MB request-body limit that a phone screenshot can
  // occasionally exceed. See lib/uploadDirect.ts and ARCHITECTURE.md #60.
  function handleSubmit(formData: FormData) {
    setError(null);
    const screenshotFile = formData.get('screenshot') as File | null;
    startTransition(async () => {
      let screenshotPath: string | null = null;
      if (screenshotFile && screenshotFile.size > 0) {
        const oversized = findOversizedFiles([screenshotFile]);
        if (oversized.length > 0) {
          setError(oversizedFilesMessage(oversized));
          return;
        }
        const urlResult = await createPaymentScreenshotUploadUrl(propertyId, screenshotFile.name);
        if (urlResult?.error || !urlResult?.path || !urlResult?.token || !urlResult?.bucket) {
          setError(urlResult?.error ?? 'Could not prepare the screenshot upload — check your connection and try again.');
          return;
        }
        const results = await uploadFilesDirect(urlResult.bucket, [{ path: urlResult.path, token: urlResult.token, file: screenshotFile }]);
        if (!results[0]?.ok) {
          setError('Screenshot failed to upload — check your connection and try again.');
          return;
        }
        screenshotPath = urlResult.path;
      }
      const result = await submitSubscriptionPayment(propertyId, formData, screenshotPath);
      if (result?.error) setError(result.error);
      else router.push('/dashboard');
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Subscribe</h2>
      {isRenewal && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>Renewing your subscription</p>
      )}

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
            <PlanPriceDisplay plan={p} isRenewal={isRenewal} />
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
      </select>

      {(method === 'UPI' || method === 'QR Code') && paymentSettings?.upi_id && (
        <div className="card section-alt" style={{ marginBottom: 16 }}>
          <p className="field-label" style={{ marginBottom: 4 }}>UPI ID</p>
          <p style={{ fontSize: 15 }}><strong>{paymentSettings.upi_id}</strong></p>
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
          <p style={{ fontSize: 14, marginBottom: 4 }}>Account Name: <strong>{paymentSettings.bank_account_name}</strong></p>
          <p style={{ fontSize: 14, marginBottom: 4 }}>Account Number: <strong>{paymentSettings.bank_account_number}</strong></p>
          <p style={{ fontSize: 14, marginBottom: 4 }}>IFSC: <strong>{paymentSettings.bank_ifsc}</strong></p>
          <p style={{ fontSize: 14 }}>Bank: <strong>{paymentSettings.bank_name}</strong></p>
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

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit for verification'}
        </button>
        <button type="button" className="btn-primary" onClick={() => router.push(`/properties/${propertyId}`)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
