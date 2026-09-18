'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateAgentContactInfo } from './onboarding.actions';
import { agentDisplayId, maskAgentPhone } from './agentDisplay';
import type { Profile, AgentProfile, AgentDocument } from '@/types/database.types';

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';

const DOC_ROWS: { type: 'driving_license' | 'secondary_id'; label: string }[] = [
  { type: 'driving_license', label: 'Driving licence' },
  { type: 'secondary_id', label: 'Secondary ID (Aadhaar/PAN)' },
];

const STATUS_LABEL: Record<string, string> = { verified: 'Verified', pending: 'Under review', rejected: 'Changes requested' };

// Redesign 2026-09 (follow-up, round 22) — "Profile & SRO" (design_handoff_
// plot360_redesign, "Plot360 Field Agent" mocks): name/Agent ID/mobile/
// visits header, "Where you work" SRO fields, and a Documents list with
// Replace/Attach, all in one Save. Shows two document rows, not four —
// the schema only ever tracks driving_license/secondary_id, same honest
// simplification as AgentVerificationDetail.tsx (admin's own agent
// review screen). "Verified <date>" in the mock becomes "Uploaded
// <date>" here — there's no per-document verification timestamp, only
// the agent's overall status above.
export function AgentProfileEditForm({
  profile,
  agentProfile,
  documents,
  completedVisits,
}: {
  profile: Profile;
  agentProfile: AgentProfile | null;
  documents: Pick<AgentDocument, 'doc_type' | 'uploaded_at'>[];
  completedVisits: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updateAgentContactInfo(formData);
      if (result?.error) setError(result.error);
      else {
        setNotice(
          (result?.emailChangeRequested ? 'Saved. Check your new email address for a confirmation link. ' : 'Saved. ') +
            'Your account has been sent back for admin reverification.'
        );
      }
    });
  }

  const status = agentProfile?.status ?? 'pending';
  const docByType = Object.fromEntries(documents.map((d) => [d.doc_type, d]));

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link href="/agent/dashboard" className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to my jobs">
          ←
        </Link>
        <h1 style={{ fontSize: 17, flex: 1 }}>My profile</h1>
        <span className="tag tag-accent">{STATUS_LABEL[status] ?? status}</span>
      </div>

      <form action={handleSubmit} style={{ maxWidth: 520, margin: '0 auto', padding: '20px 20px 60px' }}>
        <h2 style={{ fontSize: 22 }}>
          {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Agent'}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
          Agent {agentDisplayId(profile.id)} · {maskAgentPhone(profile.phone_number) ?? 'no mobile on file'} · {completedVisits} visits completed
        </p>

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Where you work</p>

        <div className="field" style={{ marginTop: 12, marginBottom: 12 }}>
          <label>SRO name</label>
          <input className="input" name="sro_name" required defaultValue={agentProfile?.sro_name ?? ''} />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>SRO number</label>
          <input className="input" name="sro_code" required defaultValue={agentProfile?.sro_code ?? ''} />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.5 }}>
          Jobs are matched to this SRO. Change it and new jobs follow the new office. <a href={SRO_HELP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>Find SRO?</a>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginTop: 16 }}>
          <div className="field">
            <label>Code</label>
            <input className="input" name="phone_country_code" defaultValue={profile.phone_country_code ?? '+91'} />
          </div>
          <div className="field">
            <label>Mobile number</label>
            <input className="input" name="phone_number" required defaultValue={profile.phone_number ?? ''} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Email</label>
          <input className="input" type="email" name="email" required defaultValue={profile.email} />
        </div>

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 24, paddingTop: 4 }} />
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Documents</p>

        {DOC_ROWS.map((row) => {
          const doc = docByType[row.type];
          return (
            <div key={row.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{row.label}</div>
                <div style={{ fontSize: 11.5, color: doc ? 'var(--p-ink-soft)' : 'var(--p-alert)', marginTop: 2 }}>
                  {doc ? `Uploaded ${doc.uploaded_at?.slice(0, 10)}` : 'Missing'}
                </div>
              </div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent-700)', cursor: 'pointer' }}>
                {doc ? 'Replace' : 'Attach'}
                <input type="file" name={row.type} accept="image/jpeg,image/png,.pdf" style={{ display: 'none' }} />
              </label>
            </div>
          );
        })}

        {error && <p style={{ color: 'var(--p-alert)', fontSize: 12.5, marginTop: 16 }}>{error}</p>}
        {notice && <p style={{ color: 'var(--p-ink-soft)', fontSize: 12.5, marginTop: 16 }}>{notice}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={isPending} style={{ marginTop: 20 }}>
          {isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
