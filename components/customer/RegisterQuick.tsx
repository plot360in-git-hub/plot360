'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createPropertyQuick } from '@/components/properties/registration/registration.actions';

// Redesign 2026-09 — simplified "Register a property" Step 1 (design_handoff_
// plot360_redesign, "Plot360 Customer.dc.html"). Only Property Name is
// required; location/size/GPS/EC-interest are optional. Everything the old
// wizard collected up front (SRO, ownership proof, documents) is gathered
// later by a representative — see registration.actions.ts,
// createPropertyQuick, and ARCHITECTURE.md.
//
// Redesign 2026-09 (follow-up) — rebuilt to actually match the mock: the
// back-button + "1 / 2" step header and progress bar, the "What should we
// call this property?" headline copy, a Google-map-pin row (see
// registration.actions.ts for why it's a text field, not a real picker —
// no Maps API key configured), an "Encumbrance certificate" section
// label, and a real hyperlink on "terms and conditions" (previously plain
// text with no link at all) — Plot flagged all of this directly.
export function RegisterQuick() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [ecInterest, setEcInterest] = useState<'yes' | 'no' | null>(null);
  const [agreed, setAgreed] = useState(false);

  const blocked = !name.trim() || !agreed;

  function handleSubmit(formData: FormData) {
    setError(null);
    if (ecInterest) formData.set('ec_interest', ecInterest);
    startTransition(async () => {
      const result = await createPropertyQuick(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to dashboard">
          ←
        </Link>
        <h1 style={{ fontSize: 17, flex: 1 }}>Register a property</h1>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--p-ink-soft)' }}>1 / 2</span>
      </div>
      <div style={{ display: 'flex', gap: 3, padding: '12px 20px 0', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ flex: 1, height: 4, background: 'var(--color-accent)' }} />
        <div style={{ flex: 1, height: 4, background: 'var(--color-divider)' }} />
      </div>

      <form action={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px' }}>
        <h2 style={{ fontSize: 23, lineHeight: 1.12 }}>What should we call this property?</h2>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 8 }}>
          Only the name is required. Leave the rest blank and a representative will collect it on WhatsApp.
        </p>

        <div className="field" style={{ marginTop: 20 }}>
          <label>
            Property name <span style={{ color: 'var(--color-accent)' }}>*</span>
          </label>
          <input
            className="input"
            name="property_name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tukkuguda North"
          />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>
            Site location <span className="text-muted">(optional)</span>
          </label>
          <input className="input" name="location" placeholder="Tukkuguda, Shamshabad, Ranga Reddy" />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>
            Site size in yards <span className="text-muted">(optional)</span>
          </label>
          <input className="input" type="number" min="0" step="0.01" name="plot_size" placeholder="e.g. 320" />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>
            Google map pin <span className="text-muted">(optional — paste a coordinate or Maps link)</span>
          </label>
          <input className="input" name="plot_gps_coordinate" placeholder="e.g. 17.2151, 78.5060, or a Google Maps link" />
        </div>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '18px 0' }} />

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)' }}>Encumbrance certificate</div>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 5 }}>
          Want a Digital Signed Certified copy of the EC delivered with your visit report?
        </p>
        <div style={{ display: 'flex', gap: 0, marginTop: 10 }}>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              minHeight: 42,
              border: '1px solid var(--color-divider)',
              background: ecInterest === 'yes' ? 'var(--color-accent)' : 'transparent',
              color: ecInterest === 'yes' ? 'var(--color-bg)' : 'var(--color-text)',
              fontSize: 12.5,
              justifyContent: 'center',
            }}
            onClick={() => setEcInterest('yes')}
          >
            Yes, include EC
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1,
              minHeight: 42,
              border: '1px solid var(--color-divider)',
              borderLeft: 0,
              background: ecInterest === 'no' ? 'var(--color-accent)' : 'transparent',
              color: ecInterest === 'no' ? 'var(--color-bg)' : 'var(--color-text)',
              fontSize: 12.5,
              justifyContent: 'center',
            }}
            onClick={() => setEcInterest('no')}
          >
            No, not needed
          </button>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, margin: '20px 0 24px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
            style={{ marginTop: 2, accentColor: 'var(--color-accent)', width: 17, height: 17 }}
          />
          <span>
            I agree to the{' '}
            <a href="/legal/terms-of-use.html" target="_blank" rel="noreferrer">
              terms and conditions
            </a>{' '}
            <span style={{ color: 'var(--color-accent)' }}>*</span> and allow a verified agent to visit and
            photograph this property for site visits I purchase.
          </span>
        </label>

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={isPending || blocked} style={{ minHeight: 48, fontSize: 14 }}>
          {isPending ? 'Saving…' : 'Choose a plan →'}
        </button>
      </form>
    </div>
  );
}
