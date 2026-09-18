'use client';

import { useState, useTransition } from 'react';
import { completeAgentRegistration } from './onboarding.actions';
import type { Profile, AgentProfile } from '@/types/database.types';

// Redesign 2026-09 (follow-up, round 22) — now only reached by a
// first-time OAuth agent (no form round-trip exists to collect name/
// mobile during the OAuth redirect itself — see agentSignUpAndRegister's
// comment, agent-auth.actions.ts) finishing the same minimal signup an
// email/password agent already completed in one step, or as a fallback
// for any pending/rejected agent somehow missing a name or mobile. SRO,
// home address and a profile photo are no longer collected here — SRO
// lives on Profile & SRO now (AgentProfileEditForm.tsx), the other two
// aren't collected anywhere in the agent flow at all.
export function AgentOnboardingForm({
  profile,
  agentProfile,
  hasDL,
  hasSecondaryId,
}: {
  profile: Profile | null;
  agentProfile: AgentProfile | null;
  hasDL: boolean;
  hasSecondaryId: boolean;
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

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 60px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>{' '}
          <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--p-ink-soft)' }}>Field Agent</span>
        </div>
        <h1 style={{ fontSize: 22, marginTop: 22 }}>A couple more details</h1>
        <p style={{ fontSize: 13, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 8 }}>
          Signed in with {profile?.email} — just your name and mobile number, and you're set.
        </p>

        {agentProfile?.status === 'rejected' && (
          <div style={{ background: 'var(--p-tint)', borderLeft: '3px solid var(--color-accent)', padding: '11px 12px', marginTop: 16 }}>
            <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Your previous submission was rejected{agentProfile.admin_notes ? `: ${agentProfile.admin_notes}` : '.'} Please update the details below and resubmit.
            </p>
          </div>
        )}

        <form action={handleSubmit} style={{ marginTop: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div className="field">
              <label>First name</label>
              <input className="input" name="first_name" required defaultValue={profile?.first_name ?? ''} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input className="input" name="last_name" required defaultValue={profile?.last_name ?? ''} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input className="input" type="email" name="email" required defaultValue={profile?.email ?? ''} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginBottom: 22 }}>
            <div className="field">
              <label>Code</label>
              <input className="input" name="phone_country_code" placeholder="+91" defaultValue={profile?.phone_country_code ?? '+91'} />
            </div>
            <div className="field">
              <label>
                Mobile number <span style={{ color: 'var(--color-accent)' }}>*</span>
              </label>
              <input className="input" name="phone_number" required defaultValue={profile?.phone_number ?? ''} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 16, marginBottom: 22 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-soft)' }}>
              Documents — optional now, needed before your first job
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Driving licence {hasDL && <span style={{ color: 'var(--p-ink-soft)', fontWeight: 400 }}>(on file)</span>}
                </label>
                <input className="input" type="file" name="driving_license" accept="image/jpeg,image/png,.pdf" style={{ fontSize: 11.5 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Secondary ID {hasSecondaryId && <span style={{ color: 'var(--p-ink-soft)', fontWeight: 400 }}>(on file)</span>}
                </label>
                <input className="input" type="file" name="secondary_id" accept="image/jpeg,image/png,.pdf" style={{ fontSize: 11.5 }} />
              </div>
            </div>
          </div>

          {error && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
            {isPending ? 'Submitting…' : 'Finish sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}
