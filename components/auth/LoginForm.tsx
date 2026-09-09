'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { logIn } from './auth.actions';

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await logIn(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 400, marginLeft: 'auto' }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>Log in to Plot360</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14.5, marginBottom: 24 }}>
        Check in on your property, wherever you are.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">Email address</label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">Password</label>
        <input className="field-input" id="password" name="password" type="password" required />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending} style={{ flex: 1 }}>
          {isPending ? 'Logging in…' : 'Log in'}
        </button>
        <Link
          href="/signup"
          className="btn-primary"
          style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
        >
          Sign up
        </Link>
      </div>

      <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Forgot email / password?
      </Link>
    </form>
  );
}
