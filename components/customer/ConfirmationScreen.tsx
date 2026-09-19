'use client';

import Link from 'next/link';
import { DISPLAY_PHONE, REPRESENTATIVE_NAME } from '@/lib/contact';

// Redesign 2026-09 (follow-up, round 2) — Plot sent the mock's own "done"
// screen screenshot ("Transfer noted. We will confirm it.") and pointed
// out it goes back to a "properties page", i.e. this needs to match the
// mock's literal "done" screen, not the generic centered-checkmark card
// this component used to be. Rebuilt from design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html", doneContent() / the `s.done` screen: a
// full-bleed colored header (kicker/title/body), a label-value rows
// table, a closing note, and a single "Back to my properties" button.
//
// Redesign 2026-09 (follow-up) — Plot: the "WhatsApp sent to <number>"
// preview box this screen used to show right after payment claimed a
// message had already been sent, but nothing here ever sent or even
// logged one — visitCredits.actions.ts (the action behind this screen)
// never calls logWhatsAppMessage, so the box was showing a completed-
// action claim with nothing behind it. Every real "WhatsApp sent" in
// this app is either an admin manually tapping a wa.me link (see
// ARCHITECTURE.md's WhatsApp outbox notes) or, at minimum, an actual
// logged outbox row an admin can act on — neither happens here, so
// showing it to the customer as fact was misleading. Removed; the body/
// next copy below already tells the customer what happens next without
// claiming it already did.
export type ConfirmationVariant =
  | { kind: 'reg-upi'; propertyName: string; planName: string; visitQuantity: number; amount: number; reference: string; expiresAt: string }
  | { kind: 'reg-bank'; propertyName: string; planName: string; amount: number }
  | { kind: 'sched'; propertyName: string; windowText: string; creditsRemaining: number; expiresAt: string };

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

type DoneContent = {
  tone: 'success' | 'pending';
  kicker: string;
  title: string;
  body: string;
  rows: { k: string; v: string }[];
  next: string;
};

function content(v: ConfirmationVariant): DoneContent {
  switch (v.kind) {
    case 'reg-upi':
      return {
        tone: 'success',
        kicker: 'Payment received',
        title: 'Registered. We take it from here.',
        body: `${REPRESENTATIVE_NAME} from Plot360 will WhatsApp you within a working day to collect documents and arrange owner approval. You do not need to fill anything else in.`,
        rows: [
          { k: 'Property', v: v.propertyName },
          { k: 'Plan', v: v.planName },
          { k: 'Paid', v: `${formatRupees(v.amount)} · UPI` },
          { k: 'Reference', v: v.reference },
          { k: 'Visit credits', v: `${v.visitQuantity} · until ${formatDate(v.expiresAt)}` },
        ],
        next: `Nothing is expected from you right now. Watch for a WhatsApp from ${DISPLAY_PHONE}.`,
      };
    case 'reg-bank':
      return {
        tone: 'pending',
        kicker: 'Awaiting confirmation',
        title: 'Transfer noted. We will confirm it.',
        body: 'Bank transfers take up to a working day to appear. Your property is registered and held; we confirm on WhatsApp the moment the amount lands.',
        rows: [
          { k: 'Property', v: v.propertyName },
          { k: 'Plan', v: v.planName },
          { k: 'Amount', v: `${formatRupees(v.amount)} · bank transfer` },
          { k: 'Status', v: 'Awaiting confirmation' },
          { k: 'Visit credits', v: 'Activate on confirmation' },
        ],
        next: 'You can close the app. Credits and scheduling unlock once the transfer is confirmed.',
      };
    case 'sched':
      return {
        tone: 'success',
        kicker: 'Visit scheduled',
        title: 'An agent will be there in that window.',
        body: 'A representative confirms the exact day a morning ahead. Your report, photos and video arrive here when the visit is approved.',
        rows: [
          { k: 'Property', v: v.propertyName },
          { k: 'Window', v: v.windowText },
          { k: 'Used', v: '1 visit credit' },
          {
            k: 'Remaining',
            v: `${v.creditsRemaining} visit credit${v.creditsRemaining === 1 ? '' : 's'} · until ${formatDate(v.expiresAt)}`,
          },
        ],
        next: 'Nothing needed from you. We will message you when the report is ready.',
      };
  }
}

// Redesign 2026-09 (follow-up) — maskedPhone used to feed the removed
// "WhatsApp sent to <number>" box below. Kept as an accepted (ignored)
// prop rather than removed from every call site, since ChoosePlanAndPay.tsx/
// ScheduleVisit.tsx passing it is harmless and it's a natural fit if a
// real per-customer confirmation is ever added here later.
export function ConfirmationScreen({
  variant,
  homeHref = '/dashboard',
}: {
  variant: ConfirmationVariant;
  maskedPhone?: string | null;
  homeHref?: string;
}) {
  const c = content(variant);

  // Redesign 2026-09 (follow-up, round 12) — Plot flagged the bank-transfer
  // "Awaiting confirmation" screen as not matching the rest of the app: it
  // was still the near-black, white-text block from before round 7 (a
  // deliberate choice at the time, to read as visually distinct from the
  // celebratory "done" screens) while everything else had moved to the
  // soft var(--gradient-hero) card. Both tones now share the same card —
  // dark text on the pastel gradient — and are told apart only by the
  // kicker: a teal pill for 'success' (payment received, visit scheduled),
  // a warm amber pill for 'pending' (awaiting confirmation), same pattern
  // as the "Expiring in N days" pill on the Home poster.
  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--gradient-hero)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-lg)',
              padding: '26px 22px 24px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.6)',
                color: c.tone === 'pending' ? '#b45309' : 'var(--color-accent-700)',
              }}
            >
              {c.kicker}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1.06,
                letterSpacing: '-.03em',
                marginTop: 14,
              }}
            >
              {c.title}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 12, maxWidth: '24em', color: 'var(--p-ink-soft)' }}>{c.body}</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 22px 0' }}>
        {c.rows.map((r) => (
          <div
            key={r.k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 0',
              borderTop: '1px solid var(--color-divider)',
              fontSize: 12.5,
            }}
          >
            <div style={{ color: 'var(--p-ink-soft)' }}>{r.k}</div>
            <div style={{ fontWeight: 600, textAlign: 'right' }}>{r.v}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 22px 40px' }}>
        <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.5 }}>{c.next}</p>
        <Link
          href={homeHref}
          className="btn btn-primary btn-block"
          style={{ minHeight: 48, fontSize: 14, marginTop: 14, textDecoration: 'none' }}
        >
          Back to my properties
        </Link>
      </div>
    </div>
  );
}
