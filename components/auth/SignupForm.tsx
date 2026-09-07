'use client';

import { useState, useTransition } from 'react';
import { signUp } from './auth.actions';
import { TurnstileWidget } from './TurnstileWidget';

export function SignupForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) setError(result.error);
      else if (result?.success) setSentTo(result.email);
    });
  }

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

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 440, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>Sign up</h2>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">Username (email)</label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">Password</label>
        <input className="field-input" id="password" name="password" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="confirmPassword">Re-enter password</label>
        <input className="field-input" id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Captcha</label>
        <TurnstileWidget />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit'}
        </button>
        <button className="btn-primary" type="reset">Reset</button>
      </div>
    </form>
  );
}