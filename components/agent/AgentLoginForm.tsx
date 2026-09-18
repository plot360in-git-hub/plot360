'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { agentLogIn } from './agent-auth.actions';
import { createClient } from '@/lib/supabase/client';

// Redesign 2026-09 (follow-up, round 22) — visually matched to the new
// Agent signup screen (same PLOT360 Field Agent header, OAuth buttons,
// .p360 field styling) even though login wasn't one of the six named
// design_handoff_plot360_redesign mock screens — kept as its own separate
// route rather than folded into signup, so a returning agent isn't shown
// name/mobile/document fields meant only for a first-time account.
export function AgentLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await agentLogIn(formData);
      if (result?.error) setError(result.error);
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

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>{' '}
          <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--p-ink-soft)' }}>Field Agent</span>
        </div>
        <h1 style={{ fontSize: 24, marginTop: 22 }}>Agent sign in</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
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
            <input className="input" name="email" type="email" required />
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Password</label>
            <input className="input" name="password" type="password" required />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <Link href="/forgot-password" style={{ fontSize: 12, color: 'var(--p-ink-soft)' }}>
              Forgot password?
            </Link>
          </div>

          {error && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', textAlign: 'center', marginTop: 14 }}>
            New agent? <Link href="/agent/signup" style={{ color: 'var(--color-text)', fontWeight: 600 }}>Register here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
