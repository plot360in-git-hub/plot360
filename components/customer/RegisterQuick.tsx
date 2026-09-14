'use client';

import { useState, useTransition } from 'react';
import { createPropertyQuick } from '@/components/properties/registration/registration.actions';

// Redesign 2026-09 — simplified "Register a property" Step 1 (design_handoff_
// plot360_redesign, "Plot360 Customer.dc.html"). Only Property Name is
// required; location/size/EC-interest are optional. Everything the old
// wizard collected up front (SRO, ownership proof, documents) is gathered
// later by a representative — see registration.actions.ts,
// createPropertyQuick, and ARCHITECTURE.md.
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
    <div className="p360" style={{ minHeight: '70vh', padding: '32px 20px 60px' }}>
      <form action={handleSubmit} style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Register a property</h1>
        <p style={{ fontSize: 14, color: 'var(--p-ink-soft)', marginBottom: 28 }}>
          Just the basics for now — we’ll take care of the paperwork with you afterwards.
        </p>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Property name *</label>
          <input
            className="input"
            name="property_name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Plot 14, Green Meadows"
          />
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Location (optional)</label>
          <input className="input" name="location" placeholder="Area, village or landmark" />
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Plot size in yards (optional)</label>
          <input className="input" type="number" min="0" step="0.01" name="plot_size" placeholder="e.g. 200" />
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginBottom: 8 }}>
            Would you like a Digital Signed Certified copy of the Encumbrance Certificate? (optional)
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                border: '1px solid var(--color-divider)',
                background: ecInterest === 'yes' ? 'var(--color-accent)' : 'transparent',
                color: ecInterest === 'yes' ? 'var(--color-bg)' : 'var(--color-text)',
                justifyContent: 'center',
              }}
              onClick={() => setEcInterest('yes')}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                border: '1px solid var(--color-divider)',
                background: ecInterest === 'no' ? 'var(--color-accent)' : 'transparent',
                color: ecInterest === 'no' ? 'var(--color-bg)' : 'var(--color-text)',
                justifyContent: 'center',
              }}
              onClick={() => setEcInterest('no')}
            >
              No
            </button>
          </div>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 24, cursor: 'pointer' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            I agree to Plot360’s terms and allow a verified agent to visit and photograph this property for site
            visits I purchase.
          </span>
        </label>

        {error && <p style={{ color: 'var(--p-alert)', marginBottom: 16, fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={isPending || blocked}>
          {isPending ? 'Saving…' : 'Continue to plans'}
        </button>
      </form>
    </div>
  );
}
