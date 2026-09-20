'use client';

import { useState, useTransition } from 'react';
import { adminLogIn } from './admin-auth.actions';

// Redesign 2026-09 (round 36) — Plot caught this by screenshot: every
// other admin screen already runs on the new design system (AdminShell,
// AccountingPage, etc.) but landing on /admin/login itself dropped
// straight back into the pre-redesign look (`.card`/`.field-label`/
// `.btn-primary` from styles/globals.css — white card, grey button, no
// Deep Navy accent, system-ui instead of Archivo) since this one file
// was never migrated when the rest of the admin console was. Rebuilt on
// `.p360`, matching AgentLoginForm.tsx's own sign-in screen (same
// wordmark-over-heading layout, `.field`/`.input`/`.btn` classes) rather
// than inventing a new pattern — admin has no OAuth or self-serve
// registration, so this keeps just the email/password form and drops
// the OAuth buttons and "New agent? Register" footer that pattern also has.
export function AdminLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await adminLogIn(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>{' '}
          <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--p-ink-soft)' }}>Admin</span>
        </div>
        <h1 style={{ fontSize: 24, marginTop: 22 }}>Admin sign in</h1>

        <form action={handleSubmit} style={{ marginTop: 20 }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="email">Username</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" required />
          </div>

          {error && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
