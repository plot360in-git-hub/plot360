'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { purchaseVisitCredits } from '@/components/payments/visitCredits.actions';
import { buildUpiLinks } from '@/lib/upi';
import { computePlotSizeSurcharge, plotSizeTierLabel, type PlotSizeTier } from '@/lib/plotSizePricing';
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
  sizeTiers,
  initialPlotSize,
}: {
  propertyId: string;
  propertyName: string;
  plans: Plan[];
  paymentSettings: PaymentSettings;
  qrUrl: string | null;
  maskedPhone?: string | null;
  // Redesign 2026-09 (follow-up, 2026-09-28) — plot-size-tiered pricing.
  // sizeTiers is the admin-configured band list (plot_size_price_tiers);
  // initialPlotSize is the property's own plot_size if it already has one
  // on file, so this screen starts from the real number instead of always
  // resetting to the standard default.
  sizeTiers: PlotSizeTier[];
  initialPlotSize?: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(plans[0]?.id ?? null);
  const [method, setMethod] = useState<'upi' | 'bank' | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationVariant | null>(null);
  // Redesign 2026-09 (follow-up) — optional: the customer can paste the
  // reference their UPI app / bank gave them for this payment, so the
  // admin has real proof to check instead of only the simulated
  // UPI-<timestamp> placeholder (see purchaseVisitCredits).
  const [transactionId, setTransactionId] = useState('');

  // Redesign 2026-09 (follow-up, 2026-09-28) — plot-size-tiered pricing.
  // The "standard" size is whichever band starts at 0 (today, admin's
  // "Up to 500 sq yd" band) — read from the tiers themselves rather than
  // hardcoded, so moving that boundary on the admin Plans page changes
  // this default too. Falls back to 500 only if admin hasn't configured
  // any bands at all yet.
  const standardSize = useMemo(() => sizeTiers.find((t) => t.min_size <= 0)?.max_size ?? 500, [sizeTiers]);
  const [plotSizeInput, setPlotSizeInput] = useState(String(initialPlotSize ?? standardSize));
  const plotSize = Number(plotSizeInput) || 0;
  const { tier: sizeTier, surcharge: sizeSurcharge, overMax: sizeOverMax } = useMemo(
    () => computePlotSizeSurcharge(sizeTiers, plotSize),
    [sizeTiers, plotSize]
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const totalPrice = selectedPlan ? selectedPlan.price + sizeSurcharge : 0;
  // Redesign 2026-09 (follow-up, 2026-09-23) — the actual name shown to
  // the customer inside their UPI app as who they're paying. Falls back
  // to a literal "Plot360" if the admin hasn't set a bank account name in
  // Payment Settings yet.
  const payeeName = paymentSettings?.bank_account_name || 'Plot360';

  function pay() {
    if (!selectedPlan || !method || sizeOverMax || plotSize <= 0) return;
    setError(null);

    if (method === 'upi') {
      if (!paymentSettings?.upi_id) {
        setError('UPI is not set up yet — please use bank transfer, or contact support.');
        return;
      }
      startTransition(async () => {
        const result = await purchaseVisitCredits(propertyId, selectedPlan.id, 'upi', plotSize, transactionId);
        if ('error' in result) {
          setError(result.error ?? null);
          return;
        }
        const links = buildUpiLinks({
          payeeVpa: paymentSettings.upi_id!,
          payeeName,
          amount: result.amount,
          note: `Plot360 ${result.planName}`,
          transactionRef: result.reference ?? '',
        });
        // Redesign 2026-09 (follow-up, 2026-09-23) — this is the part that
        // was missing entirely before: actually navigating to a upi://
        // link. The browser/OS takes it from here — Android shows its own
        // app chooser when more than one UPI app is installed, iOS opens
        // whichever app is registered for the scheme. If nothing happens
        // (no UPI app installed, or an iOS quirk with the generic link),
        // the confirmation screen below repeats this as tappable buttons,
        // including the three app-specific schemes, so the customer isn't
        // stuck with only this one automatic attempt.
        setOpening(true);
        window.location.href = links.generic;
        window.setTimeout(() => {
          setOpening(false);
          setConfirmation({
            kind: 'reg-bank',
            propertyName: result.propertyName,
            amount: result.amount,
            planName: result.planName,
            paymentMethodLabel: 'UPI',
            upiLinks: links,
            plotSize,
          });
        }, 1200);
      });
      return;
    }

    startTransition(async () => {
      const result = await purchaseVisitCredits(propertyId, selectedPlan.id, 'bank', plotSize, transactionId);
      if ('error' in result) setError(result.error ?? null);
      else
        setConfirmation({
          kind: 'reg-bank',
          propertyName: result.propertyName,
          amount: result.amount,
          planName: result.planName,
          paymentMethodLabel: 'bank transfer',
          plotSize,
        });
    });
  }

  if (confirmation) return <ConfirmationScreen variant={confirmation} maskedPhone={maskedPhone} />;

  // Redesign 2026-09 (follow-up, round 4) — same fix as ScheduleVisit.tsx:
  // this screen had no back button of its own either, so it was quietly
  // relying on the now-removed app/properties/layout.tsx header. Mock's
  // "reg2" screen (Choose visits / pay) has this same back-button row.
  const backHeader = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
      <Link
        href="/dashboard"
        className="btn btn-secondary"
        style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }}
        aria-label="Back to dashboard"
      >
        ←
      </Link>
      <h1 style={{ fontSize: 17 }}>Choose a plan</h1>
    </div>
  );

  if (plans.length === 0) {
    return (
      <div className="p360" style={{ minHeight: '80vh' }}>
        {backHeader}
        <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p style={{ maxWidth: 380, textAlign: 'center', fontSize: 14.5 }}>
            No visit plans are available to purchase right now — please check back shortly, or contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p360" style={{ minHeight: '100vh', position: 'relative' }}>
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

      {backHeader}

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 60px' }}>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 24 }}>
          For <strong>{propertyName}</strong> — visit credits are usable within 1 year of purchase.
        </p>

        {/* Redesign 2026-09 (follow-up, 2026-09-28, round 2) — Plot: moved
            plot size above the plan list (was below it) so the customer
            sets their real plot size first and the plan prices below
            already reflect it, rather than picking a plan and only then
            noticing the price changes further down the page. Also added
            the "Total to pay" line right here — the price recalculates
            live as this field changes, but that used to only be visible
            by scrolling down to a plan card or the Pay button. */}
        <div className="field" style={{ marginBottom: 20 }}>
          <label>Plot size (sq yd)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={plotSizeInput}
            onChange={(e) => setPlotSizeInput(e.target.value)}
          />
          <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 6 }}>
            {sizeOverMax
              ? "This plot size is bigger than we've priced online — contact support for a quote before paying."
              : sizeTier
                ? `Up to ${standardSize} sq yd is included in every plan's price. ${sizeSurcharge > 0 ? `${plotSizeTierLabel(sizeTier)} adds ₹${sizeSurcharge.toLocaleString('en-IN')}.` : 'This size is within the standard price — no extra charge.'}`
                : `Up to ${standardSize} sq yd is included in every plan's price at no extra charge.`}
          </p>
          {selectedPlan && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                marginTop: 10,
                padding: '10px 12px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-divider)',
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>Total for {selectedPlan.name}</span>
              <strong style={{ fontSize: 16 }}>{sizeOverMax ? 'Contact us' : `₹${totalPrice.toLocaleString('en-IN')}`}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {plans.map((plan) => {
            const selected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                style={{
                  position: 'relative',
                  width: '100%',
                  boxSizing: 'border-box',
                  textAlign: 'left',
                  // Redesign 2026-09 (follow-up, 2026-09-28, round 3) — Plot:
                  // the selected card was only distinguishable by a 1px
                  // border-width difference, easy to miss at a glance (see
                  // the screenshot — a selected card needed a hand-drawn
                  // circle to be findable). Now selected also gets a filled
                  // accent-tinted background, a thicker/more saturated
                  // border, and the "Selected" badge + checkmark corner
                  // below — kept in the site's own accent color
                  // (--color-accent, Deep Navy — deliberately chosen over
                  // teal/red in round 33, see this file's header comment)
                  // rather than introducing an unrelated green, so it
                  // matches the rest of the redesign's one-accent palette.
                  border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-divider)',
                  background: selected ? 'var(--color-accent-100)' : 'var(--color-surface)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--color-text)',
                }}
              >
                {selected && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -1,
                      width: 26,
                      height: 26,
                      background: 'var(--color-accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
                {/* Redesign 2026-09 (follow-up) — Plot: on mobile, a long plan
                    name ("1 Visit + install "Monitored by Plot360" signboard")
                    next to the "% off" tag pushed this row — and with it the
                    whole card — wider than the screen, since a nowrap flex row
                    with space-between never shrinks below its content's
                    natural width. flexWrap + minWidth: 0 on the name lets it
                    wrap onto its own line instead of forcing an overflow. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 8px', marginBottom: 4 }}>
                  <strong style={{ fontSize: 16, minWidth: 0, overflowWrap: 'break-word' }}>{plan.name}</strong>
                  <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                    {selected && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: 'var(--color-accent)',
                          color: '#fff',
                          padding: '2px 8px',
                        }}
                      >
                        Selected
                      </span>
                    )}
                    {plan.discount_percent > 0 && <span className="tag tag-accent">{plan.discount_percent}% off</span>}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {sizeOverMax ? (
                    <span style={{ fontSize: 14 }}>Contact us for a quote</span>
                  ) : (
                    <>
                      ₹{(plan.price + sizeSurcharge).toLocaleString('en-IN')}
                      {plan.base_price && plan.base_price > plan.price && (
                        <span style={{ fontSize: 13, fontWeight: 400, textDecoration: 'line-through', color: 'var(--p-ink-muted)', marginLeft: 8 }}>
                          ₹{plan.base_price.toLocaleString('en-IN')}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* Redesign 2026-09 (follow-up, 2026-09-28) — plot-size-tiered
                    pricing: shows the split (plan + size surcharge) whenever
                    the current plot size costs extra, so the price above
                    isn't a mystery. Nothing shown for the standard size
                    (surcharge 0), same as before this change. */}
                {!sizeOverMax && sizeSurcharge > 0 && (
                  <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 2 }}>
                    ₹{plan.price.toLocaleString('en-IN')} plan + ₹{sizeSurcharge.toLocaleString('en-IN')} for plot size
                  </p>
                )}
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
              // Redesign 2026-09 (follow-up, 2026-09-23, round 59) — Plot: the
              // description line under "UPI" ran out of the box on mobile.
              // .btn (plot360-redesign.css) sets white-space: nowrap for
              // ordinary single-line button labels — fine everywhere else
              // .btn is used, but here the button is a two-line label +
              // description card (flexDirection: column), and white-space is
              // inherited, so the description span kept the nowrap and spilled
              // past the card's right edge instead of wrapping. Overriding
              // back to 'normal' only where a .btn genuinely holds multi-line
              // content, same fix applied to the Bank transfer button below.
              whiteSpace: 'normal',
              width: '100%',
            }}
          >
            <span style={{ fontWeight: 800 }}>UPI</span>
            <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--p-ink-soft)' }}>
              Opens your UPI app. We confirm on WhatsApp once it's received.
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
              // See the UPI button above — same nowrap-inherited-into-the-
              // description-line fix.
              whiteSpace: 'normal',
              width: '100%',
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

        {method && (
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Payment transaction ID (optional)</label>
            <input
              className="input"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Reference number from your UPI app or bank, if you have it"
            />
          </div>
        )}

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button
          className="btn btn-primary btn-block"
          type="button"
          disabled={!selectedPlan || !method || isPending || opening || sizeOverMax || plotSize <= 0}
          onClick={pay}
        >
          {isPending ? 'Processing…' : selectedPlan ? `Pay ₹${totalPrice.toLocaleString('en-IN')}` : 'Pay'}
        </button>
      </div>
    </div>
  );
}
