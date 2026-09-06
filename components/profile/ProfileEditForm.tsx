'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyProfile } from './profile.actions';
import type { Profile } from '@/types/database.types';

function AddressFields({ prefix, label, initial }: { prefix: 'current' | 'permanent'; label: string; initial: any }) {
  return (
    <div>
      <h4 style={{ marginBottom: 12 }}>{label}</h4>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Street Address</label>
        <input className="field-input" name={`${prefix}_street`} defaultValue={initial?.street ?? ''} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">City</label>
          <input className="field-input" name={`${prefix}_city`} defaultValue={initial?.city ?? ''} />
        </div>
        <div>
          <label className="field-label">State</label>
          <input className="field-input" name={`${prefix}_state`} defaultValue={initial?.state ?? ''} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="field-label">Zip / Postal Code</label>
          <input className="field-input" name={`${prefix}_zip`} defaultValue={initial?.zip ?? ''} />
        </div>
        <div>
          <label className="field-label">Country</label>
          <select className="field-input" name={`${prefix}_country`} defaultValue={initial?.country ?? ''}>
            <option value="" disabled>Select…</option>
            <option value="IN">India</option>
            <option value="US">United States</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function ProfileEditForm({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sameAsCurrent, setSameAsCurrent] = useState(
    JSON.stringify(profile.current_address ?? {}) === JSON.stringify(profile.permanent_address ?? {})
  );
  const router = useRouter();

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

  const current = profile.current_address ?? {};
  const permanent = profile.permanent_address ?? {};

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>Edit Profile</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {profile.profile_picture_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profile_picture_url}
            alt="Profile"
            width={64}
            height={64}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
        <div style={{ flex: 1 }}>
          <label className="field-label">Profile picture</label>
          <input className="field-input" type="file" name="profile_picture" accept="image/*" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label className="field-label">First name<span style={{ color: 'var(--color-danger)' }}> *</span></label>
          <input className="field-input" name="first_name" required defaultValue={profile.first_name ?? ''} />
        </div>
        <div>
          <label className="field-label">Middle name</label>
          <input className="field-input" name="middle_name" defaultValue={profile.middle_name ?? ''} />
        </div>
        <div>
          <label className="field-label">Last name<span style={{ color: 'var(--color-danger)' }}> *</span></label>
          <input className="field-input" name="last_name" required defaultValue={profile.last_name ?? ''} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Email</label>
        <input className="field-input" type="email" name="email" required defaultValue={profile.email} />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Changing this sends a confirmation link to the new address before it takes effect.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label className="field-label">Country code</label>
          <input className="field-input" name="phone_country_code" placeholder="+91" defaultValue={profile.phone_country_code ?? ''} />
        </div>
        <div>
          <label className="field-label">Phone number</label>
          <input className="field-input" name="phone_number" defaultValue={profile.phone_number ?? ''} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
        <AddressFields prefix="current" label="Current Address" initial={current} />
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14 }}>
            <input
              type="checkbox"
              name="same_as_current"
              checked={sameAsCurrent}
              onChange={(e) => setSameAsCurrent(e.target.checked)}
            />
            Same as current address
          </label>
          {!sameAsCurrent && <AddressFields prefix="permanent" label="Permanent Address" initial={permanent} />}
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--color-success)', marginBottom: 16 }}>{notice}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
