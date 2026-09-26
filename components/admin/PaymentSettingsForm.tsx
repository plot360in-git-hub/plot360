'use client';

import { useRef, useState, useTransition } from 'react';
import { updatePaymentSettings, createPaymentQrUploadUrl } from '@/components/payments/plans.actions';
import { uploadFilesDirect } from '@/lib/uploadDirect';
import { findOversizedFiles, oversizedFilesMessage } from '@/lib/fileValidation';

export function PaymentSettingsForm({ settings, qrUrl }: { settings: any; qrUrl: string | null }) {
  const initial = {
    upi_id: settings?.upi_id ?? '',
    bank_account_name: settings?.bank_account_name ?? '',
    bank_account_number: settings?.bank_account_number ?? '',
    bank_ifsc: settings?.bank_ifsc ?? '',
    bank_name: settings?.bank_name ?? '',
    // Redesign 2026-09 (round 32) — Accounting: flat rate paid per
    // completed agent visit, read by the Agent payouts tab
    // (AccountingPage.tsx) to work out what's owed.
    agent_visit_payout_rate: settings?.agent_visit_payout_rate != null ? String(settings.agent_visit_payout_rate) : '',
  };
  const [draft, setDraft] = useState(initial);
  const [qrPicked, setQrPicked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(settings?.updated_at ? new Date(settings.updated_at).toLocaleString('en-IN') : null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = qrPicked || Object.keys(initial).some((k) => (draft as any)[k] !== (initial as any)[k]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 26 }}>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>UPI and QR</div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>UPI ID</label>
          <input className="input" style={{ minHeight: 38 }} value={draft.upi_id} onChange={(e) => setDraft({ ...draft, upi_id: e.target.value })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          {qrUrl ? (
            <img src={qrUrl} alt="Payment QR" style={{ width: 74, height: 74, objectFit: 'cover', flex: 'none' }} />
          ) : (
            <div style={{ width: 74, height: 74, background: 'var(--color-neutral-300)', flex: 'none' }} />
          )}
          <input ref={fileRef} type="file" name="qr_code_image" accept="image/*" style={{ fontSize: 11 }} onChange={() => setQrPicked(true)} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Bank transfer</div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Account name</label>
          <input className="input" style={{ minHeight: 38 }} value={draft.bank_account_name} onChange={(e) => setDraft({ ...draft, bank_account_name: e.target.value })} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Account number</label>
          <input className="input" style={{ minHeight: 38 }} value={draft.bank_account_number} onChange={(e) => setDraft({ ...draft, bank_account_number: e.target.value })} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>IFSC</label>
          <input className="input" style={{ minHeight: 38 }} value={draft.bank_ifsc} onChange={(e) => setDraft({ ...draft, bank_ifsc: e.target.value })} />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Bank name</label>
          <input className="input" style={{ minHeight: 38 }} value={draft.bank_name} onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Agent payouts</div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Rate per completed visit (₹)</label>
          <input
            className="input"
            style={{ minHeight: 38 }}
            type="number"
            min={0}
            step="0.01"
            placeholder="Not set"
            value={draft.agent_visit_payout_rate}
            onChange={(e) => setDraft({ ...draft, agent_visit_payout_rate: e.target.value })}
          />
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 8 }}>
          Used by the Accounting page to work out what's owed to each agent for their completed visits.
        </p>
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 42, fontSize: 13, padding: '0 18px' }}
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const formData = new FormData();
              for (const [k, v] of Object.entries(draft)) formData.set(k, v as string);

              // Redesign 2026-09 (follow-up) — QR image now uploads
              // straight to storage instead of through this Server
              // Action, which on Vercel has a hard 4.5MB request-body
              // limit. See lib/uploadDirect.ts and ARCHITECTURE.md #60.
              let qrPath: string | null = null;
              const qrFile = fileRef.current?.files?.[0];
              if (qrFile) {
                const oversized = findOversizedFiles([qrFile]);
                if (oversized.length > 0) {
                  setError(oversizedFilesMessage(oversized));
                  return;
                }
                const urlResult = await createPaymentQrUploadUrl(qrFile.name);
                if (urlResult?.error || !urlResult?.path || !urlResult?.token || !urlResult?.bucket) {
                  setError(urlResult?.error ?? 'Could not prepare the QR image upload — check your connection and try again.');
                  return;
                }
                const results = await uploadFilesDirect(urlResult.bucket, [{ path: urlResult.path, token: urlResult.token, file: qrFile }]);
                if (!results[0]?.ok) {
                  setError('QR image failed to upload — check your connection and try again.');
                  return;
                }
                qrPath = urlResult.path;
              }

              const result = await updatePaymentSettings(formData, qrPath);
              if (result && 'error' in result) setError(result.error ?? null);
              else {
                setSavedAt(new Date().toLocaleString('en-IN'));
                setQrPicked(false);
              }
            })
          }
        >
          Save payment settings
        </button>
        <div style={{ fontSize: 12, color: dirty ? 'var(--p-alert)' : 'var(--p-ink-soft)' }}>
          {error ? error : dirty ? 'Unsaved changes — customers still see the previously saved details' : savedAt ? `Saved ${savedAt} · these details appear on the customer's payment screen` : 'Not saved yet'}
        </div>
      </div>
    </div>
  );
}
