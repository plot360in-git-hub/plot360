'use client';

import { useState, useTransition } from 'react';
import { adminLogIn } from './admin-auth.actions';

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
    <form action={handleSubmit} className="card" style={{ maxWidth: 360, margin: '80px auto 0' }}>
      <h2 style={{ marginBottom: 24 }}>Admin sign in</h2>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">Username</label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">Password</label>
        <input className="field-input" id="password" name="password" type="password" required />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending} style={{ width: '100%' }}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
