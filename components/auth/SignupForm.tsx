'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUp } from './auth.actions';
import { TurnstileWidget } from './TurnstileWidget';

const REDIRECT_SECONDS = 4;

export function SignupForm() {
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
      const result = await signUp(formData);
      if (result?.error) {
        setError(result.error);
        setAlreadyExists(!!result.alreadyExists);
      } else if (result?.success) {
        setSentTo(result.email);
      }
    });
  }

  // Already-registered case: count down and auto-redirect to login,
  // with an immediate manual link too for anyone who doesn't want to wait.
  useEffect(() => {
    if (!alreadyExists) return;
    setCountdown(REDIRECT_SECONDS);
    const interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    const timeout = setTimeout(() => router.push('/'), REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [alreadyExists, router]);

  // "A verification email has been sent to {emailID}, please complete the
  // registration process through the verification email." — from the wireframe.
  if (sentTo) {
    return (
      <div className="card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <p>
          A verification email has been sent to <strong>{sentTo}</strong>.
          Please complete registration by following the link in that email.
        </p>
      </div>
    );
  }

  if (alreadyExists) {
    return (
      <div className="card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>An account with this email already exists.</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
          Redirecting to login in {countdown}s…
        </p>
        <Link href="/" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Log in now
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 440, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Create your account</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14.5, marginBottom: 24 }}>
        Register your property and start monitoring it in minutes.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">Email address<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">Password<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" id="password" name="password" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="confirmPassword">Re-enter password<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Captcha</label>
        <TurnstileWidget />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending} style={{ flex: 1 }}>
          {isPending ? 'Submitting…' : 'Create account'}
        </button>
        <button className="btn-primary" type="reset">Reset</button>
      </div>

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 14.5, color: 'var(--color-text-muted)' }}>
        Already have an account? <Link href="/" style={{ color: 'var(--color-accent)' }}>Log in</Link>
      </p>
    </form>
  );
}
