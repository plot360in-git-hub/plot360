'use client';

import { useState, useTransition } from 'react';
import { updateAgentContactInfo } from './onboarding.actions';
import type { Profile, AgentProfile } from '@/types/database.types';

function Required() {
  return <span style={{ color: 'var(--color-danger)' }}> *</span>;
}

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';

export function AgentProfileEditForm({ profile, agentProfile }: { profile: Profile; agentProfile: AgentProfile | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const address = (profile.current_address ?? {}) as any;

  function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateAgentContactInfo(formData);
      if (result?.error) setError(result.error);
      else {
        setNotice(
          (result?.emailChangeRequested
            ? 'Saved. Check your new email address for a confirmation link. '
            : 'Saved. ') + 'Your account has been sent back for admin reverification.'
        );
      }
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Edit Profile</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 24 }}>
        You can update your phone, email, address, and photo here. Name and ID documents
        can't be changed on this page. Saving sends your account back for admin reverification.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        {profile.profile_picture_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.profile_picture_url} alt="" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div style={{ flex: 1 }}>
          <label className="field-label">Photo (JPG or PNG)</label>
          <input className="field-input" type="file" name="profile_picture" accept="image/jpeg,image/png" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Email<Required /></label>
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
          <label className="field-label">Phone number<Required /></label>
          <input className="field-input" name="phone_number" required defaultValue={profile.phone_number ?? ''} />
        </div>
      </div>

      <h4 style={{ marginBottom: 12 }}>Home Address</h4>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Street Address<Required /></label>
        <input className="field-input" name="street" required defaultValue={address.street ?? ''} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">City<Required /></label>
          <input className="field-input" name="city" required defaultValue={address.city ?? ''} />
        </div>
        <div>
          <label className="field-label">District<Required /></label>
          <input className="field-input" name="district" required defaultValue={address.district ?? ''} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label className="field-label">State<Required /></label>
          <input className="field-input" name="state" required defaultValue={address.state ?? ''} />
        </div>
        <div>
          <label className="field-label">Zip / Postal Code<Required /></label>
          <input className="field-input" name="zip" required defaultValue={address.zip ?? ''} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="field-label">Agent residing closest SRO Name<Required /></label>
            <input className="field-input" name="sro_name" required defaultValue={agentProfile?.sro_name ?? ''} />
          </div>
          <div>
            <label className="field-label">SRO Code<Required /></label>
            <input className="field-input" name="sro_code" required defaultValue={agentProfile?.sro_code ?? ''} />
          </div>
        </div>
        <a href={SRO_HELP_URL} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--color-link)' }}>
          Find SRO?
        </a>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--color-success)', marginBottom: 16 }}>{notice}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save and send for reverification'}
      </button>
    </form>
  );
}
