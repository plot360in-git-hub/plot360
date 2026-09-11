'use client';

import { useState, useTransition } from 'react';
import { completeAgentRegistration } from './onboarding.actions';
import type { Profile, AgentProfile } from '@/types/database.types';

function Required() {
  return <span style={{ color: 'var(--color-danger)' }}> *</span>;
}

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';

export function AgentOnboardingForm({
  profile,
  agentProfile,
  hasDL,
  hasSecondaryId,
  dlDoc,
  secondaryIdDoc,
}: {
  profile: Profile | null;
  agentProfile: AgentProfile | null;
  hasDL: boolean;
  hasSecondaryId: boolean;
  dlDoc?: { name: string; url: string | null } | null;
  secondaryIdDoc?: { name: string; url: string | null } | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await completeAgentRegistration(formData);
      if (result?.error) setError(result.error);
    });
  }

  const address = profile?.current_address ?? {};

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Agent Registration</h2>
      {agentProfile?.status === 'rejected' && (
        <div className="card section-alt" style={{ marginBottom: 20, borderColor: 'var(--color-danger)' }}>
          <p style={{ fontSize: 14 }}>
            Your previous submission was rejected{agentProfile.admin_notes ? `: ${agentProfile.admin_notes}` : '.'}{' '}
            Please update the details below and resubmit.
          </p>
        </div>
      )}
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        Provide your details and ID proofs. An admin will review and verify your registration
        before you can accept property monitoring jobs.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label className="field-label">First name<Required /></label>
          <input className="field-input" name="first_name" required defaultValue={profile?.first_name ?? ''} />
        </div>
        <div>
          <label className="field-label">Middle name</label>
          <input className="field-input" name="middle_name" defaultValue={profile?.middle_name ?? ''} />
        </div>
        <div>
          <label className="field-label">Last name<Required /></label>
          <input className="field-input" name="last_name" required defaultValue={profile?.last_name ?? ''} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Email<Required /></label>
        <input className="field-input" type="email" name="email" required defaultValue={profile?.email ?? ''} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label className="field-label">Country code</label>
          <input className="field-input" name="phone_country_code" placeholder="+91" defaultValue={profile?.phone_country_code ?? ''} />
        </div>
        <div>
          <label className="field-label">Phone number<Required /></label>
          <input className="field-input" name="phone_number" required defaultValue={profile?.phone_number ?? ''} />
        </div>
      </div>

      <h4 style={{ marginBottom: 12 }}>Home Address</h4>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Street Address<Required /></label>
        <input className="field-input" name="street" required defaultValue={(address as any).street ?? ''} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">City<Required /></label>
          <input className="field-input" name="city" required defaultValue={(address as any).city ?? ''} />
        </div>
        <div>
          <label className="field-label">District<Required /></label>
          <input className="field-input" name="district" required defaultValue={(address as any).district ?? ''} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <label className="field-label">State<Required /></label>
          <input className="field-input" name="state" required defaultValue={(address as any).state ?? ''} />
        </div>
        <div>
          <label className="field-label">Zip / Postal Code<Required /></label>
          <input className="field-input" name="zip" required defaultValue={(address as any).zip ?? ''} />
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

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Photo of agent (JPG or PNG)<Required /></label>
        <input className="field-input" type="file" name="profile_picture" accept="image/jpeg,image/png" required={!profile?.profile_picture_url} />
        {profile?.profile_picture_url && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Currently uploaded:{' '}
            <a href={profile.profile_picture_url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
              view photo
            </a>
            {' — choose a file only to replace it.'}
          </p>
        )}
      </div>

      <h4 style={{ marginBottom: 12 }}>ID Proofs</h4>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Driving License (JPG, PNG, or PDF)<Required /></label>
        <input className="field-input" type="file" name="driving_license" accept="image/jpeg,image/png,.pdf" required={!hasDL} />
        {hasDL && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Currently uploaded:{' '}
            {dlDoc?.url ? (
              <a href={dlDoc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>{dlDoc.name}</a>
            ) : (
              dlDoc?.name ?? 'file on record'
            )}
            {' — choose a file only to replace it.'}
          </p>
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Second Govt ID — Aadhar / PAN / other (JPG, PNG, or PDF)<Required /></label>
        <input className="field-input" type="file" name="secondary_id" accept="image/jpeg,image/png,.pdf" required={!hasSecondaryId} />
        {hasSecondaryId && (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Currently uploaded:{' '}
            {secondaryIdDoc?.url ? (
              <a href={secondaryIdDoc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>{secondaryIdDoc.name}</a>
            ) : (
              secondaryIdDoc?.name ?? 'file on record'
            )}
            {' — choose a file only to replace it.'}
          </p>
        )}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit for verification'}
      </button>
    </form>
  );
}
