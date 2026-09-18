'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { agentSignUpAndRegister } from './agent-auth.actions';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { createClient } from '@/lib/supabase/client';

const REDIRECT_SECONDS = 4;

// Redesign 2026-09 (follow-up, round 22) — Agent signup (design_handoff_
// plot360_redesign, "Plot360 Field Agent" mocks, "Agent signup" screen):
// one combined screen — OAuth, or email/password + mobile number, with
// documents optional now ("needed before your first job"). Two honest
// additions beyond what the mock screenshot shows (likely below the fold
// on the actual phone-height mock): a "Confirm password" field (can't
// safely skip this for a real password account) and First/Last name
// (an admin reviewing this agent needs a name — the mock's later Profile
// screen already shows one, it just isn't visible landing on this
// cropped view). The mock's "Username" field is the real Email field,
// styled to match — this app authenticates by email, not a separate
// username system.
export function AgentSignupForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setAlreadyExists(false);
    startTransition(async () => {
      const result = await agentSignUpAndRegister(formData);
      if (result?.error) {
        setError(result.error);
        setAlreadyExists(!!result.alreadyExists);
      } else if (result?.success) {
        setSentTo(result.email);
      }
    });
  }

  async function handleOAuth(provider: 'google' | 'facebook') {
    setOauthError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/agent/auth/callback` },
    });
    if (oauthErr) setOauthError(oauthErr.message);
  }

  useEffect(() => {
    if (!alreadyExists) return;
    setCountdown(REDIRECT_SECONDS);
    const interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    const timeout = setTimeout(() => router.push('/agent/login'), REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [alreadyExists, router]);

  const shell = (children: React.ReactNode) => (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>{' '}
          <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--p-ink-soft)' }}>Field Agent</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (sentTo) {
    return shell(
      <div style={{ marginTop: 26 }}>
        <h1 style={{ fontSize: 22 }}>Check your email</h1>
        <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)', lineHeight: 1.55, marginTop: 10 }}>
          A verification link has been sent to <strong>{sentTo}</strong>. Confirm it, then log in — your account and
          documents are already saved.
        </p>
      </div>
    );
  }

  if (alreadyExists) {
    return shell(
      <div style={{ marginTop: 26, textAlign: 'center' }}>
        <p style={{ fontSize: 14 }}>An account with this email already exists.</p>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 10 }}>Redirecting to agent login in {countdown}s…</p>
        <Link href="/agent/login" className="btn btn-primary" style={{ marginTop: 16, textDecoration: 'none', display: 'inline-flex' }}>
          Log in now
        </Link>
      </div>
    );
  }

  return shell(
    <>
      <h1 style={{ fontSize: 26, lineHeight: 1.15, marginTop: 22 }}>Get paid visits near your SRO.</h1>
      <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 10 }}>
        Sign up, send your documents once, and we assign visits that match the sub-registrar office you work in.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        <button type="button" className="btn btn-secondary" style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }} onClick={() => handleOAuth('google')}>
          Continue with Google
        </button>
        <button type="button" className="btn btn-secondary" style={{ justifyContent: 'flex-start', minHeight: 46, fontSize: 13 }} onClick={() => handleOAuth('facebook')}>
          Continue with Facebook
        </button>
      </div>
      {oauthError && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{oauthError}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
        <span style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--p-ink-muted)' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: 'var(--color-divider)' }} />
      </div>

      <form action={handleSubmit}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input className="input" name="email" type="email" placeholder="rajesh.field@example.com" required />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input className="input" name="password" type="password" required minLength={8} />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Confirm password</label>
          <input className="input" name="confirmPassword" type="password" required minLength={8} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="field">
            <label>First name</label>
            <input className="input" name="first_name" required />
          </div>
          <div className="field">
            <label>Last name</label>
            <input className="input" name="last_name" required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginBottom: 22 }}>
          <div className="field">
            <label>Code</label>
            <input className="input" name="phone_country_code" defaultValue="+91" />
          </div>
          <div className="field">
            <label>
              Mobile number <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input className="input" name="phone_number" placeholder="98480 00000" required />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-soft)' }}>
            Documents — optional now, needed before your first job
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Driving licence</label>
              <input className="input" type="file" name="driving_license" accept="image/jpeg,image/png,.pdf" multiple style={{ fontSize: 11.5 }} />
              <p style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>Front and back — select both at once.</p>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Secondary ID (Aadhaar/PAN)</label>
              <input className="input" type="file" name="secondary_id" accept="image/jpeg,image/png,.pdf" multiple style={{ fontSize: 11.5 }} />
              <p style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>Front and back — select both at once.</p>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <TurnstileWidget />
        </div>

        {error && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create agent account'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', textAlign: 'center', marginTop: 14 }}>
          Already registered? <Link href="/agent/login" style={{ color: 'var(--color-text)', fontWeight: 600 }}>Log in</Link>
        </p>
      </form>
    </>
  );
}
