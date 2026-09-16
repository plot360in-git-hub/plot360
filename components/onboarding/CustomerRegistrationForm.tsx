'use client';

import { useState, useTransition } from 'react';
import { saveCustomerRegistration } from './onboarding.actions';
import { logOut } from '@/components/auth/auth.actions';
import { COUNTRY_CODES, DEFAULT_COUNTRY_DIAL } from '@/lib/countryCodes';

// Redesign 2026-09 (follow-up, round 10) — Plot reported that a brand-new
// customer signing up via a social login (Google) was landing on the OLD,
// pre-redesign "Customer Registration" wizard (username, DOB, gender,
// profile picture, a full current + permanent address pair, identity-proof
// upload, security questions — none of it styled with the .p360 system).
// Rebuilt from scratch as a single-page form with only what Plot asked
// for: first/middle/last name, a country-code list of values (defaulting
// to +91) + phone number, and links-not-just-text Terms/Privacy checkboxes
// — matching the same .p360 card/field/btn system every other redesigned
// customer screen uses (see RegisterQuick.tsx for the closest precedent:
// same "only ask what's required" philosophy, applied here to the
// account itself rather than a property). Address, DOB, gender, profile
// picture, identity proof and security questions are no longer collected
// at signup — nothing else in the app reads those fields yet, and if a
// later phase needs them, an admin/representative can still collect them
// the same way property documents are collected post-registration. The
// `profiles` columns themselves are untouched (still nullable) so this is
// a pure UI/action simplification, not a schema change.
export function CustomerRegistrationForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  const blocked = !firstName.trim() || !lastName.trim() || !phone.trim() || !termsAgreed || !privacyAgreed;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCustomerRegistration(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '18px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>
        </div>
      </div>

      <form action={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 60px' }}>
        <h1 style={{ fontSize: 23, lineHeight: 1.15 }}>Tell us who you are</h1>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 8 }}>
          Just your name and number — a representative collects anything else we need on WhatsApp.
        </p>

        {/* Redesign 2026-09 (follow-up, round 11) — Plot asked for these
            stacked in name order (first, then middle, then last) rather
            than side by side, so middle name always sits directly under
            first name and above last name regardless of screen width. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
          <div className="field">
            <label>
              First name <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input
              className="input"
              name="first_name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              Middle name <span className="text-muted">(optional)</span>
            </label>
            <input className="input" name="middle_name" />
          </div>
          <div className="field">
            <label>
              Last name <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <input
              className="input"
              name="last_name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 12, marginTop: 14 }}>
          <div className="field">
            <label>
              Country code <span style={{ color: 'var(--color-accent)' }}>*</span>
            </label>
            <select className="input" name="phone_country_code" required defaultValue={DEFAULT_COUNTRY_DIAL}>
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
            <input
              className="input"
              name="phone_number"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98480 00000"
            />
          </div>
        </div>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '22px 0' }} />

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="terms_accepted"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
            required
            style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 17, height: 17 }}
          />
          <span>
            I accept Plot360's{' '}
            <a href="/legal/terms-of-use.html" target="_blank" rel="noreferrer">
              Terms &amp; Conditions
            </a>
            <span style={{ color: 'var(--color-accent)' }}> *</span>
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, marginBottom: 24, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="privacy_accepted"
            checked={privacyAgreed}
            onChange={(e) => setPrivacyAgreed(e.target.checked)}
            required
            style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 17, height: 17 }}
          />
          <span>
            I accept Plot360's{' '}
            <a href="/legal/privacy-policy.html" target="_blank" rel="noreferrer">
              Privacy Policy &amp; Agreements
            </a>
            <span style={{ color: 'var(--color-accent)' }}> *</span>
          </span>
        </label>

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={isPending || blocked}
            style={{ flex: 1, minHeight: 48, fontSize: 14, justifyContent: 'center' }}
          >
            {isPending ? 'Saving…' : 'Submit'}
          </button>
          <button
            className="btn"
            type="submit"
            formAction={logOut}
            formNoValidate
            disabled={isPending}
            style={{ flex: 'none', minHeight: 48, fontSize: 14, padding: '0 22px', border: '1px solid var(--color-divider)', color: 'var(--color-text)' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
