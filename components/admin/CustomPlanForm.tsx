'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fulfillCustomPlanWithLog } from './review-decisions.actions';
import { declineCustomPlanRequest } from './customPlan.actions';
import { buildWhatsAppLink } from './whatsapp';

// Redesign 2026-09 (follow-up, 2026-10-03) — custom visit plans, the
// admin-facing form. Used two ways from PropertyVerificationDetail.tsx:
// fulfilling a pending request the customer made on the payment screen
// (existingPaymentId set, form opens automatically) or setting one up
// proactively with no prior request (existingPaymentId omitted, starts
// collapsed behind a "Set up a custom plan" button). Either way it's
// the same form and the same action (fulfillCustomPlanWithLog) — the
// only difference is whether an existing pending payments row gets
// updated in place or a new, already-completed one gets inserted (see
// customPlan.actions.ts, fulfillCustomPlan).
export function CustomPlanForm({ propertyId, existingPaymentId }: { propertyId: string; existingPaymentId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!existingPaymentId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await fulfillCustomPlanWithLog(propertyId, formData, existingPaymentId);
      if ('error' in result) {
        setError(result.error ?? null);
        return;
      }
      if ('phoneNumber' in result && result.phoneNumber) {
        setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message));
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  // Redesign 2026-09 (follow-up, 2026-10-03, round 2) — Plot asked for a
  // way to dismiss a request the admin isn't going to pursue, rather
  // than only being able to fulfill one. No WhatsApp here (unlike a
  // fulfilled plan, there's no agreed plan to confirm) — see
  // declineCustomPlanRequest's own note.
  function handleDecline() {
    if (!existingPaymentId) return;
    if (!window.confirm("Decline this customer's custom plan request? They'll be able to ask again later if they want to.")) return;
    setError(null);
    startTransition(async () => {
      const result = await declineCustomPlanRequest(existingPaymentId);
      if ('error' in result) {
        setError(result.error ?? null);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (waLink) {
    return (
      <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 9, paddingTop: 10 }}>
        <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginBottom: 8 }}>Saved. Now send the customer their WhatsApp:</p>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{ minHeight: 34, fontSize: 11.5, padding: '0 12px', textDecoration: 'none', display: 'inline-flex' }}
        >
          Send via WhatsApp
        </a>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 34, fontSize: 11.5, padding: '0 12px', marginLeft: 8 }}
          onClick={() => {
            setWaLink(null);
            setOpen(false);
            router.refresh();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11 }} onClick={() => setOpen(true)}>
        Set up a custom plan
      </button>
    );
  }

  return (
    <form action={handleSubmit} style={{ borderTop: '1px solid var(--color-divider)', marginTop: 9, paddingTop: 10 }}>
      <div className="field">
        <label>Agreed rate (₹)</label>
        <input className="input" style={{ minHeight: 34, fontSize: 12 }} type="number" step="0.01" name="amount" required inputMode="decimal" />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Visits agreed</label>
        <input className="input" style={{ minHeight: 34, fontSize: 12 }} type="number" min={1} name="visit_quantity" required />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Credit validity (months)</label>
        <input className="input" style={{ minHeight: 34, fontSize: 12 }} type="number" min={1} name="validity_months" defaultValue={12} required />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Payment method</label>
        <select className="input" style={{ minHeight: 34, fontSize: 12 }} name="payment_method" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          <option value="Cash">Cash</option>
          <option value="Bank transfer">Bank transfer</option>
          <option value="UPI">UPI</option>
          <option value="Cheque">Cheque</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Date received</label>
        <input className="input" style={{ minHeight: 34, fontSize: 12 }} type="date" name="paid_at" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Reference (optional)</label>
        <input className="input" style={{ minHeight: 34, fontSize: 12 }} name="transaction_reference" />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>What was agreed (optional note)</label>
        <textarea
          className="input"
          style={{ minHeight: 50, fontSize: 12 }}
          name="notes"
          rows={2}
          placeholder="e.g. Monthly visits × 6, or 20 visits over the year"
        />
      </div>

      {error && <p style={{ fontSize: 11.5, color: 'var(--p-alert)', marginTop: 8 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn btn-primary" style={{ minHeight: 32, fontSize: 11.5, padding: '0 12px' }} disabled={pending}>
          {pending ? 'Saving…' : 'Save custom plan'}
        </button>
        {existingPaymentId ? (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 32, fontSize: 11.5, padding: '0 12px' }}
            disabled={pending}
            onClick={handleDecline}
          >
            Decline request
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" style={{ minHeight: 32, fontSize: 11.5, padding: '0 12px' }} onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
