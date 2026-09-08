'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { agentSignUp } from './agent-auth.actions';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';

const REDIRECT_SECONDS = 4;

export function AgentSignupForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setAlreadyExists(false);
    startTransition(async () => {
      const result = await agentSignUp(formData);
      if (result?.error) {
        setError(result.error);
        setAlreadyExists(!!result.alreadyExists);
      } else if (result?.success) {
        setSentTo(result.email);
      }
    });
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

  if (sentTo) {
    return (
      <div className="card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <p>
          A verification email has been sent to <strong>{sentTo}</strong>. After confirming,
          log in and complete your agent registration (personal details and ID proofs).
        </p>
      </div>
    );
  }

  if (alreadyExists) {
    return (
      <div className="card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>An account with this email already exists.</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
          Redirecting to agent login in {countdown}s…
        </p>
        <Link href="/agent/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Log in now
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 440, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Agent Sign up</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 24 }}>
        Field agents register here, then complete their profile and verification.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Email</label>
        <input className="field-input" name="email" type="email" required />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Password</label>
        <input className="field-input" name="password" type="password" required minLength={8} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Re-enter password</label>
        <input className="field-input" name="confirmPassword" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Captcha</label>
        <TurnstileWidget />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Create agent account'}
      </button>
    </form>
  );
}
