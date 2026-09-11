'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { agentLogIn } from './agent-auth.actions';

export function AgentLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await agentLogIn(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 360, margin: '80px auto 0' }}>
      <h2 style={{ marginBottom: 24 }}>Agent sign in</h2>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Email</label>
        <input className="field-input" name="email" type="email" required />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Password</label>
        <input className="field-input" name="password" type="password" required />
      </div>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Forgot password?
        </Link>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending} style={{ width: '100%', marginBottom: 12 }}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
      <Link href="/agent/signup" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        New agent? Register here
      </Link>
    </form>
  );
}
