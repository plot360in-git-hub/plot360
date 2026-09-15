'use client';

import { useState, useTransition } from 'react';
import { resendConfirmationEmail } from './auth.actions';

// Redesign 2026-09 (follow-up) — matches design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html", the "Confirm email" screen. One deliberate
// content change from the literal mock: that mock's primary button reads
// "I've confirmed — continue" and just jumps to the next mock screen on
// click, with no real check behind it. We can't do that for real — only
// actually clicking the emailed link confirms the account (Supabase's
// /auth/callback route handles that redirect) — so faking a "continue"
// button here would let someone into the app without ever confirming.
// This button is a real "resend" action instead. Flagged to Plot.
export function ConfirmEmailScreen({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resend() {
    setError(null);
    setResent(false);
    startTransition(async () => {
      const result = await resendConfirmationEmail(email);
      if (result?.error) setError(result.error);
      else setResent(true);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '48px 20px 60px' }}>
        <div style={{ width: 46, height: 46, background: 'var(--color-accent)' }} />
        <h1 style={{ fontSize: 26, lineHeight: 1.1, marginTop: 22 }}>Confirm your email</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 12 }}>
          We sent a confirmation link to <strong>{email}</strong>. Open it once and you&apos;re registered —
          nothing else to fill in.
        </p>
        <div style={{ height: 2, background: 'var(--color-divider)', margin: '22px 0' }} />
        <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', lineHeight: 1.5 }}>
          Wrong address?{' '}
          <button
            type="button"
            onClick={onChangeEmail}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              color: 'var(--color-accent)',
              cursor: 'pointer',
              font: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Change email and try again
          </button>
        </p>

        {error && <p style={{ color: 'var(--p-alert)', fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button
          className="btn btn-primary btn-block"
          type="button"
          onClick={resend}
          disabled={isPending || resent}
          style={{ minHeight: 48, fontSize: 14, marginTop: 22 }}
        >
          {resent ? 'Confirmation email resent' : isPending ? 'Resending…' : "Didn't get it? Resend"}
        </button>
      </div>
    </div>
  );
}
