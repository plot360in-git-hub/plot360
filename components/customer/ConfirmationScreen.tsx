'use client';

import Link from 'next/link';
import { WA_LINK, DISPLAY_PHONE, REPRESENTATIVE_NAME } from '@/lib/contact';

// Redesign 2026-09 — the customer app's shared "done" screen (design_handoff_
// plot360_redesign, "Plot360 Customer.dc.html"): one component, four
// copy variants, each with the exact WhatsApp confirmation text from the
// design so what a customer reads in-app matches what they'd get on
// WhatsApp. Rendered inline (as local state) at the end of whichever flow
// finished, rather than as its own route, mirroring the design's
// single-screen "done" overlay.
export type ConfirmationVariant =
  | { kind: 'reg-upi'; propertyName: string; amount: number; planName: string }
  | { kind: 'reg-bank'; propertyName: string; amount: number }
  | { kind: 'sched'; propertyName: string; windowText: string; creditsRemaining: number; expiresAt: string };

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function whatsappMessage(v: ConfirmationVariant): string {
  switch (v.kind) {
    case 'reg-upi':
      return `Plot360: Thank you. We have registered ${v.propertyName} and received ${formatRupees(v.amount)} by UPI. Your ${v.planName} plan is active. ${REPRESENTATIVE_NAME} will contact you within one working day for documents and owner approval.`;
    case 'reg-bank':
      return `Plot360: We have registered ${v.propertyName}. Your bank transfer of ${formatRupees(v.amount)} is awaiting confirmation — we will message you as soon as it is credited, usually within one working day.`;
    case 'sched':
      return `Plot360: Your site visit for ${v.propertyName} is scheduled between ${v.windowText}. ${v.creditsRemaining} visit credit${v.creditsRemaining === 1 ? '' : 's'} remain on this property, usable until ${formatDate(v.expiresAt)}.`;
  }
}

function heading(v: ConfirmationVariant): string {
  switch (v.kind) {
    case 'reg-upi':
      return 'You’re all set';
    case 'reg-bank':
      return 'Registered — payment pending';
    case 'sched':
      return 'Visit scheduled';
  }
}

function body(v: ConfirmationVariant): React.ReactNode {
  switch (v.kind) {
    case 'reg-upi':
      return (
        <>
          <strong>{v.propertyName}</strong> is registered and your {v.planName} plan is active.{' '}
          {REPRESENTATIVE_NAME} will contact you within one working day for documents and owner approval.
        </>
      );
    case 'reg-bank':
      return (
        <>
          <strong>{v.propertyName}</strong> is registered. Your bank transfer of {formatRupees(v.amount)} is
          awaiting confirmation — we’ll message you on WhatsApp as soon as it’s credited, usually within one
          working day.
        </>
      );
    case 'sched':
      return (
        <>
          Your site visit for <strong>{v.propertyName}</strong> is scheduled between {v.windowText}.{' '}
          {v.creditsRemaining} visit credit{v.creditsRemaining === 1 ? '' : 's'} remain on this property, usable
          until {formatDate(v.expiresAt)}.
        </>
      );
  }
}

export function ConfirmationScreen({ variant, homeHref = '/dashboard' }: { variant: ConfirmationVariant; homeHref?: string }) {
  const message = whatsappMessage(variant);
  return (
    <div className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 20px',
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>{heading(variant)}</h1>
        <p style={{ fontSize: 14.5, color: 'var(--p-ink-soft)', marginBottom: 24, lineHeight: 1.5 }}>{body(variant)}</p>

        <div style={{ borderTop: '2px solid var(--color-divider)', paddingTop: 16, marginBottom: 24 }}>
          <p style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--p-ink-muted)', marginBottom: 8 }}>
            We’ll also send this to your WhatsApp
          </p>
          <p style={{ fontSize: 13, background: 'var(--color-surface)', padding: 12, textAlign: 'left' }}>{message}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={`${WA_LINK}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-block"
          >
            Open WhatsApp ({DISPLAY_PHONE})
          </a>
          <Link href={homeHref} className="btn btn-secondary btn-block" style={{ textDecoration: 'none' }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
