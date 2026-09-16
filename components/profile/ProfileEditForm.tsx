'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateMyProfile, changeMyPassword } from './profile.actions';
import { COUNTRY_CODES, DEFAULT_COUNTRY_DIAL } from '@/lib/countryCodes';
import type { Profile } from '@/types/database.types';

// Redesign 2026-09 (follow-up, round 11) — full rebuild. The old form
// (profile picture, a full current + permanent address pair, none of it
// .p360-styled) is replaced with the same fields and layout as the
// redesigned onboarding form (CustomerRegistrationForm.tsx) — name stacked
// first/middle/last, country code + phone — plus what a *returning* user
// actually needs that a one-time signup form doesn't: an editable email
// (already re-verified via Supabase's own confirmation-link flow before
// this round, kept as-is) and, new, a change-password section that
// re-verifies the current password before applying a new one and emails a
// "your password was changed" notice, same as the existing reset-password
// flow. Address/identity-proof/profile-picture are dropped along with the
// fields that collected them — see profile.actions.ts for the same note.
export function ProfileEditForm({ profile, hasPassword }: { profile: Profile; hasPassword: boolean }) {
  const router = useRouter();

  // ---- profile details (name, phone, email) ----
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateMyProfile(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setNotice(
          result?.emailChangeRequested
            ? 'Saved. Check your new email address for a confirmation link — the email change takes effect once you click it.'
            : 'Profile updated.'
        );
        router.refresh();
      }
    });
  }

  // ---- password ----
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  function handlePasswordSubmit(formData: FormData) {
    setPasswordError(null);
    setPasswordNotice(null);
    startPasswordTransition(async () => {
      const result = await changeMyPassword(formData);
      if (result?.error) setPasswordError(result.error);
      else setPasswordNotice('Password changed. A confirmation email has been sent to your address.');
    });
  }

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link
          href="/dashboard"
          className="btn btn-secondary"
          style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }}
          aria-label="Back to dashboard"
        >
          ←
        </Link>
        <h1 style={{ fontSize: 17 }}>Edit profile</h1>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 40px' }}>
        <form action={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label>
                First name <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input className="input" name="first_name" required defaultValue={profile.first_name ?? ''} />
            </div>
            <div className="field">
              <label>
                Middle name <span className="text-muted">(optional)</span>
              </label>
              <input className="input" name="middle_name" defaultValue={profile.middle_name ?? ''} />
            </div>
            <div className="field">
              <label>
                Last name <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input className="input" name="last_name" required defaultValue={profile.last_name ?? ''} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12, marginTop: 14 }}>
            <div className="field">
              <label>
                Country code <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <select
                className="input"
                name="phone_country_code"
                required
                defaultValue={profile.phone_country_code || DEFAULT_COUNTRY_DIAL}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.name} value={c.dial}>
                    {c.dial} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                Phone number <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input className="input" name="phone_number" type="tel" required defaultValue={profile.phone_number ?? ''} />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Email</label>
            <input className="input" type="email" name="email" required defaultValue={profile.email} />
            <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 6 }}>
              Changing this sends a confirmation link to the new address — the change takes effect once you click it.
            </p>
          </div>

          {error && <p style={{ color: 'var(--p-alert)', marginTop: 16, fontSize: 13.5 }}>{error}</p>}
          {notice && <p style={{ color: 'var(--color-accent-700)', marginTop: 16, fontSize: 13.5 }}>{notice}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={isPending} style={{ minHeight: 48, fontSize: 14, marginTop: 20, justifyContent: 'center' }}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '32px 0 24px' }} />

        <h2 style={{ fontSize: 17 }}>Change password</h2>

        {hasPassword ? (
          <form action={handlePasswordSubmit} style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginBottom: 14 }}>
              Confirm your current password to set a new one. We'll email you once it's changed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Current password</label>
                <input className="input" type="password" name="current_password" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label>New password</label>
                <input className="input" type="password" name="new_password" autoComplete="new-password" required minLength={8} />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input className="input" type="password" name="confirm_password" autoComplete="new-password" required minLength={8} />
              </div>
            </div>

            {passwordError && <p style={{ color: 'var(--p-alert)', marginTop: 16, fontSize: 13.5 }}>{passwordError}</p>}
            {passwordNotice && <p style={{ color: 'var(--color-accent-700)', marginTop: 16, fontSize: 13.5 }}>{passwordNotice}</p>}

            <button
              className="btn btn-primary btn-block"
              type="submit"
              disabled={isPasswordPending}
              style={{ minHeight: 48, fontSize: 14, marginTop: 20, justifyContent: 'center' }}
            >
              {isPasswordPending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 14 }}>
            Your account signs in with Google — there's no password to change here.
          </p>
        )}
      </div>
    </div>
  );
}
