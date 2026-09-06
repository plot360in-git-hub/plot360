'use client';

import { useState, useTransition } from 'react';
import { agentSignUp } from './agent-auth.actions';

export function AgentSignupForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await agentSignUp(formData);
      if (result?.error) setError(result.error);
      else if (result?.success) setSentTo(result.email);
    });
  }

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

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Create agent account'}
      </button>
    </form>
  );
}
