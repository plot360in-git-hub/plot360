'use client';

import { useState, useTransition } from 'react';
import { updateAgentVerificationFields } from './agents.actions';

// Redesign 2026-09 (follow-up) — Agent verification detail screen. Plot:
// "In Agent verification page all fields should be editable to admin and
// reviewer." These four fields (mobile, email, SRO name, SRO number)
// used to be readOnly inputs with no save path at all. Now a small
// client island with its own Save button; everything else on the page
// (documents, header, actions) stays a plain server-rendered read.
export function AgentVerificationEditableFields({
  agentId,
  phoneCountryCode,
  phoneNumber,
  email,
  sroName,
  sroCode,
}: {
  agentId: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  sroName: string;
  sroCode: string;
}) {
  const [values, setValues] = useState({ phoneCountryCode, phoneNumber, email, sroName, sroCode });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: string) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateAgentVerificationFields(agentId, values);
      if ('error' in result) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
        <div className="field">
          <label>Code</label>
          <input className="input" style={{ minHeight: 38 }} value={values.phoneCountryCode} onChange={(e) => set('phoneCountryCode', e.target.value)} />
        </div>
        <div className="field">
          <label>Mobile number</label>
          <input className="input" style={{ minHeight: 38 }} value={values.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div className="field">
          <label>Email</label>
          <input className="input" style={{ minHeight: 38 }} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div />
        <div className="field">
          <label>SRO name</label>
          <input className="input" style={{ minHeight: 38 }} value={values.sroName} onChange={(e) => set('sroName', e.target.value)} />
        </div>
        <div className="field">
          <label>SRO number</label>
          <input className="input" style={{ minHeight: 38 }} value={values.sroCode} onChange={(e) => set('sroCode', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 38, fontSize: 12.5, padding: '0 16px' }} disabled={isPending} onClick={handleSave}>
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>Saved.</span>}
        {error && <span style={{ fontSize: 11.5, color: 'var(--p-alert)' }}>{error}</span>}
      </div>
      <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 6 }}>
        Editing email here updates the record only — it does not change the agent&apos;s login. Jobs are matched to the SRO number above against the property&apos;s SRO.
      </p>
    </div>
  );
}
