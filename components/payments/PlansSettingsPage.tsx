'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPlan, togglePlanActive, updatePaymentSettings } from './plans.actions';

export function PlansSettingsPage({ plans, paymentSettings, qrUrl }: { plans: any[]; paymentSettings: any; qrUrl: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [planError, setPlanError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const router = useRouter();

  function handlePlanSubmit(formData: FormData) {
    setPlanError(null);
    startTransition(async () => {
      const result = await upsertPlan(formData);
      if (result?.error) setPlanError(result.error);
      else {
        setEditingPlan(null);
        router.refresh();
      }
    });
  }

  function handleToggle(planId: string, isActive: boolean) {
    startTransition(async () => {
      await togglePlanActive(planId, isActive);
      router.refresh();
    });
  }

  function handleSettingsSubmit(formData: FormData) {
    setSettingsError(null);
    startTransition(async () => {
      const result = await updatePaymentSettings(formData);
      if (result?.error) setSettingsError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 32 }}>Plans & Payment Settings</h1>

      <div className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 16 }}>Subscription Plans</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ textAlign: 'left', fontSize: 13, color: 'var(--color-text-muted)' }}>
              <th style={{ padding: '6px 0' }}>Name</th>
              <th>Price</th>
              <th>Validity</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 0' }}>{p.name}</td>
                <td>₹{p.price}</td>
                <td>{p.validity_months} months</td>
                <td>
                  <span className={`status-pill ${p.is_active ? 'verified' : 'rejected'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 13, marginRight: 8 }} onClick={() => setEditingPlan(p)}>
                    Edit
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => handleToggle(p.id, !p.is_active)}
                    disabled={isPending}
                  >
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!editingPlan && (
          <button className="btn-primary" onClick={() => setEditingPlan({})}>
            + Add plan
          </button>
        )}

        {editingPlan && (
          <form action={handlePlanSubmit} className="card section-alt" style={{ marginTop: 16 }}>
            <input type="hidden" name="id" defaultValue={editingPlan.id ?? ''} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="field-label">Name</label>
                <input className="field-input" name="name" required defaultValue={editingPlan.name ?? ''} />
              </div>
              <div>
                <label className="field-label">Price (₹)</label>
                <input className="field-input" type="number" name="price" required defaultValue={editingPlan.price ?? ''} />
              </div>
              <div>
                <label className="field-label">Validity (months)</label>
                <input className="field-input" type="number" name="validity_months" required defaultValue={editingPlan.validity_months ?? 12} />
              </div>
              <div>
                <label className="field-label">Display order</label>
                <input className="field-input" type="number" name="display_order" defaultValue={editingPlan.display_order ?? 0} />
              </div>
            </div>
            {planError && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{planError}</p>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save plan'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditingPlan(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <form action={handleSettingsSubmit} className="card">
        <h3 style={{ marginBottom: 16 }}>Payment Details Shown to Customers</h3>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">UPI ID</label>
          <input className="field-input" name="upi_id" defaultValue={paymentSettings?.upi_id ?? ''} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="field-label">Bank Account Name</label>
            <input className="field-input" name="bank_account_name" defaultValue={paymentSettings?.bank_account_name ?? ''} />
          </div>
          <div>
            <label className="field-label">Account Number</label>
            <input className="field-input" name="bank_account_number" defaultValue={paymentSettings?.bank_account_number ?? ''} />
          </div>
          <div>
            <label className="field-label">IFSC</label>
            <input className="field-input" name="bank_ifsc" defaultValue={paymentSettings?.bank_ifsc ?? ''} />
          </div>
          <div>
            <label className="field-label">Bank Name</label>
            <input className="field-input" name="bank_name" defaultValue={paymentSettings?.bank_name ?? ''} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">QR Code Image</label>
          {qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Current QR code" style={{ width: 120, display: 'block', marginBottom: 8 }} />
          )}
          <input className="field-input" type="file" name="qr_code_image" accept="image/*" />
        </div>
        {settingsError && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{settingsError}</p>}
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save payment details'}
        </button>
      </form>
    </div>
  );
}
