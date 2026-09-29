'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPlan, togglePlanActive, deletePlan } from '@/components/payments/plans.actions';

function computeFinal(basePrice: number, discountPercent: number) {
  return Math.round(basePrice * (1 - discountPercent / 100));
}

export function PlansTable({ plans }: { plans: any[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rowPendingId, setRowPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function startEdit(plan: any) {
    setEditingId(plan.id);
    setDraft({ ...plan });
    setError(null);
  }

  // Redesign 2026-09 (follow-up, 2026-09-28, round 2) — Plot: "display or
  // hide" a plan from the payment page. is_active is exactly what
  // getActiveVisitPlans/getActivePlans already filter the customer-facing
  // screen on — this just exposes the toggle that PlansSettingsPage.tsx
  // (the older, unreferenced admin Plans screen) had but the live
  // PlansTable/PlansPricingPage pairing never did.
  function handleToggleActive(plan: any) {
    setNotice(null);
    setRowPendingId(plan.id);
    startTransition(async () => {
      const result = await togglePlanActive(plan.id, !plan.is_active);
      setRowPendingId(null);
      if (result && 'error' in result) setError(result.error ?? null);
      else router.refresh();
    });
  }

  // Redesign 2026-09 (follow-up, 2026-09-28, round 2) — Plot asked for a
  // way to delete a plan. Confirms first (irreversible), then falls back
  // gracefully — see deletePlan's own comment (plans.actions.ts) — to
  // deactivating instead when the plan has real payment history, which
  // already hides it from the payment page the same as a delete would
  // have for a customer, without losing that history.
  function handleDelete(plan: any) {
    if (!window.confirm(`Delete "${plan.name}"? This can't be undone.`)) return;
    setNotice(null);
    setRowPendingId(plan.id);
    startTransition(async () => {
      const result = await deletePlan(plan.id);
      setRowPendingId(null);
      if (result && 'error' in result) {
        setError(result.error ?? null);
      } else {
        if (result?.deactivatedInstead) {
          setNotice(`"${plan.name}" has existing payments on it, so it was deactivated instead of deleted — it no longer shows on the payment page.`);
        }
        if (editingId === plan.id) {
          setEditingId(null);
          setDraft(null);
        }
        router.refresh();
      }
    });
  }

  const final = draft ? computeFinal(Number(draft.base_price) || 0, Number(draft.discount_percent) || 0) : 0;

  return (
    <div>
      {notice && (
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', background: 'var(--p-tint)', padding: '8px 10px', marginTop: 12 }}>
          {notice}
        </p>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 18 }}>
          <thead>
            <tr>
              {['Plan', 'Visits', 'Base', 'Discount', 'Final', 'Validity', 'Status', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px 8px 0', borderBottom: '2px solid var(--color-divider)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} style={{ background: editingId === p.id ? 'var(--p-tint)' : 'transparent' }}>
                <td style={{ padding: '9px 10px 9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{p.visit_quantity}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>₹{Number(p.base_price ?? 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{Math.round(p.discount_percent ?? 0)}%</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>₹{computeFinal(p.base_price ?? 0, p.discount_percent ?? 0).toLocaleString('en-IN')}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{p.validity_months === 12 ? '1 year' : `${p.validity_months} months`}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>
                  <span className={`status-pill ${p.is_active ? 'verified' : 'rejected'}`}>{p.is_active ? 'Active' : 'Hidden'}</span>
                </td>
                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-secondary" style={{ minHeight: 28, fontSize: 11, marginRight: 6 }} onClick={() => startEdit(p)}>
                    {editingId === p.id ? 'Editing' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 28, fontSize: 11, marginRight: 6 }}
                    disabled={pending && rowPendingId === p.id}
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 28, fontSize: 11 }}
                    disabled={pending && rowPendingId === p.id}
                    onClick={() => handleDelete(p)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div style={{ border: '2px solid var(--color-accent)', padding: '16px 18px', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>Editing {draft.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>Final price is base minus discount, rounded to the rupee</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 13 }}>
            <div className="field">
              <label>Plan name</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Visits included</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.visit_quantity} onChange={(e) => setDraft({ ...draft, visit_quantity: e.target.value })} />
            </div>
            <div className="field">
              <label>Base price (₹)</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.base_price} onChange={(e) => setDraft({ ...draft, base_price: e.target.value })} />
            </div>
            <div className="field">
              <label>Discount (%)</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.discount_percent} onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })} />
            </div>
            <div className="field">
              <label>Validity (months)</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.validity_months} onChange={(e) => setDraft({ ...draft, validity_months: e.target.value })} />
            </div>
            <div className="field">
              <label>Renewal discount (%, optional)</label>
              <input
                className="input"
                style={{ minHeight: 38 }}
                value={draft.renewal_discount_percent ?? ''}
                placeholder="Same as above"
                onChange={(e) => setDraft({ ...draft, renewal_discount_percent: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5 }}>
              Customer pays <strong>₹{final.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>
              Credits valid {Number(draft.validity_months) === 12 ? 'one year' : `${draft.validity_months} months`} from payment
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 40, fontSize: 12.5, padding: '0 16px' }}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const formData = new FormData();
                  formData.set('id', draft.id);
                  formData.set('name', draft.name);
                  formData.set('base_price', String(draft.base_price));
                  formData.set('discount_percent', String(draft.discount_percent));
                  formData.set('validity_months', String(draft.validity_months));
                  formData.set('renewal_discount_percent', draft.renewal_discount_percent === '' || draft.renewal_discount_percent == null ? '' : String(draft.renewal_discount_percent));
                  formData.set('display_order', String(draft.display_order ?? 0));
                  formData.set('visit_quantity', String(draft.visit_quantity));
                  const result = await upsertPlan(formData);
                  if (result && 'error' in result) setError(result.error ?? null);
                  else {
                    setEditingId(null);
                    setDraft(null);
                    router.refresh();
                  }
                })
              }
            >
              Save plan
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 40, fontSize: 12.5, padding: '0 16px' }}
              onClick={() => {
                setEditingId(null);
                setDraft(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
