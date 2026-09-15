'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { logIn, signUp, sendPhoneOtp, verifyPhoneOtp } from './auth.actions';
import { createClient } from '@/lib/supabase/client';
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
//  - Google / Facebook call real Supabase OAuth (signInWithOAuth); WhatsApp
//    OTP calls real Supabase phone auth (sendPhoneOtp/verifyPhoneOtp in
//    auth.actions.ts) via a small inline phone → code sub-flow the mock
//    doesn't show (the mock draws WhatsApp OTP as a single button with no
//    room for a code-entry step). All three only actually work once Plot
//    finishes the provider setup in the Supabase dashboard (Google/
//    Facebook OAuth apps, Twilio WhatsApp for phone auth) — until then
//    they'll surface Supabase's real "provider not enabled" error, which
//    is more honest than pretending to work.
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
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [waStep, setWaStep] = useState<'closed' | 'phone' | 'code'>('closed');
  const [waPhone, setWaPhone] = useState('');
  const [waCode, setWaCode] = useState('');
  const [waSentTo, setWaSentTo] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waPending, startWaTransition] = useTransition();

  const isSignup = tab === 'signup';

  async function handleOAuth(provider: 'google' | 'facebook') {
    setOauthError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success this navigates the browser away to the provider's consent
    // screen, so there's nothing else to do here — only the failure case
    // (e.g. provider not yet enabled in Supabase) returns to this code.
    if (oauthErr) setOauthError(oauthErr.message);
  }

  function sendWaCode() {
    setWaError(null);
    startWaTransition(async () => {
      const result = await sendPhoneOtp(waPhone.trim());
      if (result?.error) setWaError(result.error);
      else {
        setWaSentTo(waPhone.trim());
        setWaStep('code');
      }
    });
  }

  function verifyWaCode() {
    setWaError(null);
    startWaTransition(async () => {
      const result = await verifyPhoneOtp(waSentTo ?? waPhone.trim(), waCode.trim());
      // On success verifyPhoneOtp redirects server-side — only the failure
      // case returns a value here.
      if (result?.error) setWaError(result.error);
    });
  }

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
              onClick={() => handleOAuth('google')}
            >
              Continue with Google
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }}
              onClick={() => handleOAuth('facebook')}
            >
              Continue with Facebook
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }}
              onClick={() => {
                setWaError(null);
                setWaStep(waStep === 'closed' ? 'phone' : 'closed');
              }}
            >
              Continue with WhatsApp OTP
            </button>
          </div>
          {oauthError && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{oauthError}</p>}

          {waStep !== 'closed' && (
            <div style={{ border: '1px solid var(--color-divider)', padding: 14, marginTop: 10 }}>
              {waStep === 'phone' && (
                <>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label htmlFor="waPhone">WhatsApp number</label>
                    <input
                      className="input"
                      id="waPhone"
                      type="tel"
                      placeholder="+91 98480 00000"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                    />
                  </div>
                  {waError && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 8 }}>{waError}</p>}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ minHeight: 40, fontSize: 13 }}
                    disabled={waPending || !waPhone.trim()}
                    onClick={sendWaCode}
                  >
                    {waPending ? 'Sending…' : 'Send code on WhatsApp'}
                  </button>
                </>
              )}
              {waStep === 'code' && (
                <>
                  <p style={{ fontSize: 12.5, marginBottom: 10 }}>
                    Code sent to <strong>{waSentTo}</strong> on WhatsApp.
                  </p>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label htmlFor="waCode">6-digit code</label>
                    <input
                      className="input"
                      id="waCode"
                      inputMode="numeric"
                      maxLength={6}
                      value={waCode}
                      onChange={(e) => setWaCode(e.target.value)}
                    />
                  </div>
                  {waError && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 8 }}>{waError}</p>}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ minHeight: 40, fontSize: 13 }}
                    disabled={waPending || waCode.trim().length < 6}
                    onClick={verifyWaCode}
                  >
                    {waPending ? 'Verifying…' : 'Verify and continue'}
                  </button>
                </>
              )}
            </div>
          )}

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
