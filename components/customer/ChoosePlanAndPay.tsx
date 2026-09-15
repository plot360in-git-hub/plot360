'use client';

import { useState, useTransition } from 'react';
import { purchaseVisitCredits } from '@/components/payments/visitCredits.actions';
import { ConfirmationScreen, type ConfirmationVariant } from './ConfirmationScreen';

type Plan = {
  id: string;
  name: string;
  base_price: number | null;
  price: number;
  discount_percent: number;
  visit_quantity: number;
};

type PaymentSettings = {
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
} | null;

// Redesign 2026-09 — Register Step 2 / Payment (design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html"). Plans come from the real, admin-configured
// subscription_plans table (see visitCredits.actions.ts,
// getActiveVisitPlans) rather than the design mock's hardcoded ₹2,499/
// ₹8,999 — an admin needs an active 1-visit and 4-visit plan for this to
// look like the design. UPI is a simulated instant activation (no live
// gateway yet); bank transfer shows the same UPI ID / bank details the
// pre-redesign subscribe page already uses (payment_settings, admin-
// configurable), and records a pending payment for an admin to confirm.
export function ChoosePlanAndPay({
  propertyId,
  propertyName,
  plans,
  paymentSettings,
  qrUrl,
  maskedPhone,
}: {
  propertyId: string;
  propertyName: string;
  plans: Plan[];
  paymentSettings: PaymentSettings;
  qrUrl: string | null;
  maskedPhone?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [method, setMethod] = useState<'upi' | 'bank' | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationVariant | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

  function pay() {
    if (!selectedPlan || !method) return;
    setError(null);

    if (method === 'upi') {
      setOpening(true);
      window.setTimeout(() => {
        setOpening(false);
        startTransition(async () => {
          const result = await purchaseVisitCredits(propertyId, selectedPlan.id, 'upi');
          if ('error' in result) setError(result.error);
          else
            setConfirmation({
              kind: 'reg-upi',
              propertyName: result.propertyName,
              amount: result.amount,
              planName: result.planName,
              visitQuantity: result.visitQuantity,
              reference: result.reference,
              expiresAt: result.expiresAt,
            });
        });
      }, 1400);
      return;
    }

    startTransition(async () => {
      const result = await purchaseVisitCredits(propertyId, selectedPlan.id, 'bank');
      if ('error' in result) setError(result.error);
      else setConfirmation({ kind: 'reg-bank', propertyName: result.propertyName, amount: result.amount, planName: result.planName });
    });
  }

  if (confirmation) return <ConfirmationScreen variant={confirmation} maskedPhone={maskedPhone} />;

  if (plans.length === 0) {
    return (
      <div className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ maxWidth: 380, textAlign: 'center', fontSize: 14.5 }}>
          No visit plans are available to purchase right now — please check back shortly, or contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="p360" style={{ minHeight: '70vh', padding: '32px 20px 60px', position: 'relative' }}>
      {opening && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(32,30,29,0.85)',
            color: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            fontSize: 15,
          }}
        >
          Opening your UPI app…
        </div>
      )}

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Choose a plan</h1>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 24 }}>
          For <strong>{propertyName}</strong> — visit credits are usable within 1 year of purchase.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {plans.map((plan) => {
            const selected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                style={{
                  textAlign: 'left',
                  border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                  background: 'var(--color-surface)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--color-text)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <strong style={{ fontSize: 16 }}>{plan.name}</strong>
                  {plan.discount_percent > 0 && (
                    <span className="tag tag-accent">{plan.discount_percent}% off</span>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  ₹{plan.price.toLocaleString('en-IN')}
                  {plan.base_price && plan.base_price > plan.price && (
                    <span style={{ fontSize: 13, fontWeight: 400, textDecoration: 'line-through', color: 'var(--p-ink-muted)', marginLeft: 8 }}>
                      ₹{plan.base_price.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
                  {plan.visit_quantity} site visit{plan.visit_quantity === 1 ? '' : 's'}
                </p>
              </button>
            );
          })}
        </div>

        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Pay with</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setMethod('upi')}
            className="btn"
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              border: method === 'upi' ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
              padding: '14px 16px',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
            }}
          >
            <span style={{ fontWeight: 800 }}>UPI</span>
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--p-ink-soft)' }}>
              Opens your UPI app. Credits activate immediately.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className="btn"
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              border: method === 'bank' ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
              padding: '14px 16px',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
            }}
          >
            <span style={{ fontWeight: 800 }}>Bank transfer</span>
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--p-ink-soft)' }}>
              Takes up to a working day. We confirm on WhatsApp once credited.
            </span>
          </button>
        </div>

        {method === 'upi' && paymentSettings?.upi_id && (
          <div className="card section-alt" style={{ marginBottom: 20, padding: 14 }}>
            <p style={{ fontSize: 13 }}>
              UPI ID: <strong>{paymentSettings.upi_id}</strong>
            </p>
            {qrUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="UPI QR code" style={{ width: 120, marginTop: 10 }} />
            )}
          </div>
        )}
        {method === 'bank' && paymentSettings?.bank_account_number && (
          <div className="card section-alt" style={{ marginBottom: 20, padding: 14, fontSize: 13, lineHeight: 1.7 }}>
            <p>Account name: <strong>{paymentSettings.bank_account_name}</strong></p>
            <p>Account number: <strong>{paymentSettings.bank_account_number}</strong></p>
            <p>IFSC: <strong>{paymentSettings.bank_ifsc}</strong></p>
            <p>Bank: <strong>{paymentSettings.bank_name}</strong></p>
          </div>
        )}

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button
          className="btn btn-primary btn-block"
          type="button"
          disabled={!selectedPlan || !method || isPending || opening}
          onClick={pay}
        >
          {isPending ? 'Processing…' : selectedPlan ? `Pay ₹${selectedPlan.price.toLocaleString('en-IN')}` : 'Pay'}
        </button>
      </div>
    </div>
  );
}
