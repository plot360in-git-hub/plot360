'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPlan, togglePlanActive, updatePaymentSettings } from './plans.actions';
import { computePlanPrice } from '@/lib/subscription';

function PlanPricePreview({ basePrice, discountPercent }: { basePrice: string; discountPercent: string }) {
  const base = Number(basePrice) || 0;
  const discount = Number(discountPercent) || 0;
  if (!base) return null;
  const final = computePlanPrice(base, discount);
  return (
    <div style={{ fontSize: 14, marginTop: 4 }}>
      {discount > 0 ? (
        <>
          <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', marginRight: 8 }}>₹{base}</span>
          <span style={{ background: '#fbe9d0', color: '#8a5a10', borderRadius: 6, padding: '1px 6px', fontSize: 12, marginRight: 8 }}>
            {discount}% off
          </span>
          <strong>₹{final}</strong>
        </>
      ) : (
        <strong>₹{base}</strong>
      )}
    </div>
  );
}

export function PlansSettingsPage({ plans, paymentSettings, qrUrl }: { plans: any[]; paymentSettings: any; qrUrl: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [planError, setPlanError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [basePriceInput, setBasePriceInput] = useState('');
  const [discountInput, setDiscountInput] = useState('0');
  const router = useRouter();

  function openEditor(plan: any) {
    setEditingPlan(plan);
    setBasePriceInput(plan.base_price != null ? String(plan.base_price) : '');
    setDiscountInput(plan.discount_percent != null ? String(plan.discount_percent) : '0');
  }

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
              <th style={{ padding: '6px 0' }}>Plan</th>
              <th>Base price</th>
              <th>Discount</th>
              <th>You pay</th>
              <th>Renewal discount</th>
              <th>Validity</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 0' }}>{p.name}</td>
                <td style={{ textDecoration: p.discount_percent > 0 ? 'line-through' : 'none', color: p.discount_percent > 0 ? 'var(--color-text-muted)' : undefined }}>
                  ₹{p.base_price ?? p.price}
                </td>
                <td>{p.discount_percent > 0 ? `${p.discount_percent}% off` : '—'}</td>
                <td><strong>₹{p.price}</strong></td>
                <td>{p.renewal_discount_percent != null ? `${p.renewal_discount_percent}% off` : 'Same as above'}</td>
                <td>{p.validity_months} months</td>
                <td>
                  <span className={`status-pill ${p.is_active ? 'verified' : 'rejected'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 13, marginRight: 8 }} onClick={() => openEditor(p)}>
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
          <button className="btn-primary" onClick={() => openEditor({})}>
            + Add plan
          </button>
        )}

        {editingPlan && (
          <form action={handlePlanSubmit} className="card section-alt" style={{ marginTop: 16 }}>
            <input type="hidden" name="id" defaultValue={editingPlan.id ?? ''} />
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Plan name</label>
              <input className="field-input" name="name" required defaultValue={editingPlan.name ?? ''} placeholder="e.g. 1 visit / 6 months" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 4 }}>
              <div>
                <label className="field-label">Base price (₹)</label>
                <input
                  className="field-input"
                  type="number"
                  name="base_price"
                  required
                  value={basePriceInput}
                  onChange={(e) => setBasePriceInput(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Discount % (first purchase)</label>
                <input
                  className="field-input"
                  type="number"
                  name="discount_percent"
                  min={0}
                  max={100}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Renewal discount % (optional)</label>
                <input
                  className="field-input"
                  type="number"
                  name="renewal_discount_percent"
                  min={0}
                  max={100}
                  defaultValue={editingPlan.renewal_discount_percent ?? ''}
                  placeholder="Same as above"
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Leave renewal discount blank to use the same discount as a first purchase.
            </p>
            <PlanPricePreview basePrice={basePriceInput} discountPercent={discountInput} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0 12px' }}>
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
