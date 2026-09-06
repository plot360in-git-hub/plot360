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
    <form action={handleSubmit} className="card" style={{ maxWidth: 360 }}>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">Username</label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">Password</label>
        <input className="field-input" id="password" name="password" type="password" required />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 14 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Logging in…' : 'Login'}
        </button>
        <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
          Signup
        </Link>
      </div>

      <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Forgot username / password?
      </Link>
    </form>
  );
}
