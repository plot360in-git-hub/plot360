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
// table, a "WhatsApp sent to <customer's own number>" preview box, a
// closing note, and a single "Back to my properties" button — no second
// "Open WhatsApp" button (the mock doesn't have one; the message is sent
// automatically by Plot360, not something the customer opens themselves).
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
  bg: 'accent' | 'ink';
  kicker: string;
  title: string;
  body: string;
  rows: { k: string; v: string }[];
  whatsapp: string;
  next: string;
};

function content(v: ConfirmationVariant): DoneContent {
  switch (v.kind) {
    case 'reg-upi':
      return {
        bg: 'accent',
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
        whatsapp: `Plot360: Thank you. We have registered ${v.propertyName} and received ${formatRupees(v.amount)} by UPI (ref ${v.reference}). Your ${v.planName} plan is active. ${REPRESENTATIVE_NAME} will contact you within one working day for documents and owner approval.`,
        next: `Nothing is expected from you right now. Watch for a WhatsApp from ${DISPLAY_PHONE}.`,
      };
    case 'reg-bank':
      return {
        bg: 'ink',
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
        whatsapp: `Plot360: We have registered ${v.propertyName}. Your bank transfer of ${formatRupees(v.amount)} is awaiting confirmation — we will message you as soon as it is credited, usually within one working day.`,
        next: 'You can close the app. Credits and scheduling unlock once the transfer is confirmed.',
      };
    case 'sched':
      return {
        bg: 'accent',
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
        whatsapp: `Plot360: Your site visit for ${v.propertyName} is scheduled between ${v.windowText}. ${v.creditsRemaining} visit credit${v.creditsRemaining === 1 ? '' : 's'} remain on this property, usable until ${formatDate(v.expiresAt)}.`,
        next: 'Nothing needed from you. We will message you when the report is ready.',
      };
  }
}

export function ConfirmationScreen({
  variant,
  maskedPhone,
  homeHref = '/dashboard',
}: {
  variant: ConfirmationVariant;
  // Redesign 2026-09 (follow-up, round 2) — the mock's "WhatsApp sent to
  // 9848 ••• 21" line is the *customer's own* masked number (same format
  // as the poster header on Home), not Plot360's support line. Optional
  // because a couple of call sites don't have the profile loaded yet;
  // falls back to generic text rather than showing nothing.
  maskedPhone?: string | null;
  homeHref?: string;
}) {
  const c = content(variant);
  const isAccent = c.bg === 'accent';

  // Redesign 2026-09 (follow-up, round 7) — was a full-bleed solid-color
  // band (accent for "done"/celebratory screens, dark ink for the
  // bank-transfer "awaiting confirmation" one). Accent branch now uses the
  // same inset var(--gradient-hero) card + dark text treatment as the Home
  // poster, per Plot's facebook.com/developers reference. The ink branch's
  // colors are unchanged (still solid dark, still white text — nothing
  // there was coupled to the accent color) but it's inset and rounded too,
  // so both "done" variants read as the same kind of card, just two moods.
  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div
            style={{
              background: isAccent ? 'var(--gradient-hero)' : 'var(--color-text)',
              color: isAccent ? 'var(--color-text)' : 'var(--color-bg)',
              borderRadius: 'var(--radius-lg)',
              padding: '26px 22px 24px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: isAccent ? 'var(--color-accent-700)' : 'var(--color-bg)',
                opacity: isAccent ? 1 : 0.8,
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
                marginTop: 12,
              }}
            >
              {c.title}
            </div>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                marginTop: 12,
                maxWidth: '24em',
                color: isAccent ? 'var(--p-ink-soft)' : undefined,
              }}
            >
              {c.body}
            </p>
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

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 22px 0' }}>
        <div
          style={{
            background: 'var(--color-surface)',
            padding: 14,
            borderLeft: '3px solid var(--color-accent)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-soft)' }}>
            WhatsApp sent to {maskedPhone ?? 'your number'}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 7 }}>{c.whatsapp}</div>
        </div>
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
