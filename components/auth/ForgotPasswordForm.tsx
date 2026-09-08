'use client';

import { useState, useTransition } from 'react';
import { forgotPassword } from './auth.actions';

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await forgotPassword(formData);
      if (result?.error) setError(result.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="card" style={{ maxWidth: 400, margin: '80px auto 0', textAlign: 'center' }}>
        <p>
          If an account exists for that email, a password reset link has been sent.
          Check your inbox (and spam folder) for the next few minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 400, margin: '80px auto 0' }}>
      <h2 style={{ marginBottom: 8 }}>Forgot password</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 24 }}>
        Enter your account email and we'll send you a link to reset your password.
      </p>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label" htmlFor="email">Email</label>
        <input className="field-input" id="email" name="email" type="email" required />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending} style={{ width: '100%' }}>
        {isPending ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}
