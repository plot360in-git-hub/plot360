'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { logIn, signUp } from './auth.actions';
import { TurnstileWidget } from './TurnstileWidget';
import { ConfirmEmailScreen } from './ConfirmEmailScreen';

type Tab = 'login' | 'signup';

// Redesign 2026-09 (follow-up) — this screen was missed in the original
// "customer app" phase: design_handoff_plot360_redesign's "Plot360
// Customer.dc.html" mock includes a combined Log in / Sign up screen with
// tabs, but /login and /signup were left rendering the old pre-redesign
// LoginForm/SignupForm, and that gap was never actually flagged to Plot
// (ARCHITECTURE.md's customer-app section never lists auth as "not done").
// This fixes that. LoginForm.tsx, SignupForm.tsx and ForgotPasswordForm.tsx
// are kept completely untouched (unused-but-not-deleted) — same pattern as
// the rest of the redesign.
//
// Deviations from the literal mock, all functionally necessary rather than
// cosmetic choices:
//  - Google / Facebook / WhatsApp OTP are drawn exactly as in the mock but
//    are NOT wired to a real provider (none is configured in this project)
//    — clicking one shows an inline note instead of silently doing nothing.
//  - The signup tab includes the site's Cloudflare Turnstile captcha,
//    which isn't in the mock at all. Removing it would remove the app's
//    only bot-signup protection, so it stays, just visually squeezed in.
//  - A "Forgot email / password?" link is added on the login tab (existing
//    /forgot-password route) — the mock doesn't show one, but the app
//    already has this flow and dropping the entry point would strand it.
export function AuthScreen({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);
  const [inertNote, setInertNote] = useState<string | null>(null);

  const isSignup = tab === 'signup';

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      if (isSignup) {
        // The mock has no separate "re-enter password" field — signUp()
        // still accepts one for the old SignupForm, so just mirror password
        // into it when it's absent instead of touching that check.
        if (!formData.get('confirmPassword')) {
          formData.set('confirmPassword', String(formData.get('password') ?? ''));
        }
        const result = await signUp(formData);
        if (result?.error) setError(result.error);
        else if (result?.success && result.email) setConfirmSentTo(result.email);
      } else {
        const result = await logIn(formData);
        if (result?.error) setError(result.error);
      }
    });
  }

  if (confirmSentTo) {
    return <ConfirmEmailScreen email={confirmSentTo} onChangeEmail={() => setConfirmSentTo(null)} />;
  }

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '40px 20px 60px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>
        </div>
        <h1 style={{ fontSize: 30, lineHeight: 1.1, marginTop: 22 }}>
          Someone stands on your land, so you don&apos;t have to.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginTop: 12, lineHeight: 1.5 }}>
          Sign in and a Plot360 representative takes it from there over WhatsApp.
        </p>

        <div
          style={{
            display: 'flex',
            margin: '26px 0 0',
            borderTop: '2px solid var(--color-divider)',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('login')}
            style={{
              flex: 1,
              minHeight: 46,
              border: 0,
              borderRight: '1px solid var(--color-divider)',
              background: !isSignup ? 'var(--color-text)' : 'transparent',
              color: !isSignup ? 'var(--color-bg)' : 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              cursor: 'pointer',
            }}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            style={{
              flex: 1,
              minHeight: 46,
              border: 0,
              background: isSignup ? 'var(--color-text)' : 'transparent',
              color: isSignup ? 'var(--color-bg)' : 'var(--color-text)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              cursor: 'pointer',
            }}
          >
            Sign up
          </button>
        </div>

        <form action={handleSubmit} style={{ padding: '22px 0 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }}
              onClick={() => setInertNote("Google sign-in isn't connected yet — use email and password below.")}
            >
              Continue with Google
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }}
              onClick={() => setInertNote("Facebook sign-in isn't connected yet — use email and password below.")}
            >
              Continue with Facebook
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }}
              onClick={() => setInertNote("WhatsApp OTP sign-in isn't connected yet — use email and password below.")}
            >
              Continue with WhatsApp OTP
            </button>
          </div>
          {inertNote && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{inertNote}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)' }}>
              or
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" placeholder="ravi@example.com" required />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={isSignup ? 8 : undefined}
            />
          </div>

          {isSignup && (
            <>
              <div className="field" style={{ marginBottom: 12 }}>
                <label htmlFor="phone">Phone number</label>
                <input className="input" id="phone" name="phone" type="tel" placeholder="+91 98480 00000" />
              </div>
              <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.45, margin: '4px 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 17, height: 17 }}
                />
                <span>
                  I agree to the{' '}
                  <a href="/legal/terms-of-use.html" target="_blank" rel="noreferrer">
                    terms and conditions
                  </a>{' '}
                  <span style={{ color: 'var(--color-accent)' }}>*</span>
                </span>
              </label>
              <div style={{ margin: '12px 0' }}>
                <TurnstileWidget />
              </div>
            </>
          )}

          {error && <p style={{ color: 'var(--p-alert)', marginTop: 4, marginBottom: 8, fontSize: 13.5 }}>{error}</p>}

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={isPending || (isSignup && !agreed)}
            style={{ minHeight: 48, fontSize: 14, marginTop: 12 }}
          >
            {isPending ? (isSignup ? 'Creating account…' : 'Logging in…') : isSignup ? 'Create account' : 'Log in'}
          </button>

          <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 12, lineHeight: 1.5 }}>
            {isSignup
              ? 'Email, password and phone are all we ask. We send one confirmation link to your email.'
              : 'New here? Switch to Sign up above — it only takes a minute.'}
          </p>

          {!isSignup && (
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--p-ink-soft)', display: 'inline-block', marginTop: 10 }}>
              Forgot email / password?
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
