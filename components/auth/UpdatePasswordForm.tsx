'use client';

import { useState, useTransition } from 'react';
import { updatePassword } from './auth.actions';

export function UpdatePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 400, margin: '80px auto 0' }}>
      <h2 style={{ marginBottom: 24 }}>Set a new password</h2>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="password">New password</label>
        <input className="field-input" id="password" name="password" type="password" required minLength={8} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label" htmlFor="confirmPassword">Re-enter new password</label>
        <input className="field-input" id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 14 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending} style={{ width: '100%' }}>
        {isPending ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}