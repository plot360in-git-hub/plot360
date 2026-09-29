'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertPlotSizeTier, deletePlotSizeTier } from '@/components/payments/plans.actions';
import { plotSizeTierLabel, type PlotSizeTier } from '@/lib/plotSizePricing';

// Redesign 2026-09 (follow-up, 2026-09-28) — admin console, Plans &
// pricing screen. Plot: every visit plan (PlansTable above) already
// covers a standard plot size at no extra charge — this is the second
// pricing dimension, an admin-defined extra charge for plots bigger than
// that standard size, added on top of whichever visit plan the customer
// picks (one shared size table for every plan, not a price matrix — the
// simpler of the two options, Plot's call). Same editable-row pattern as
// PlansTable.tsx. See supabase/schema.sql (plot_size_price_tiers) and
// lib/plotSizePricing.ts for the shape and reasoning; ChoosePlanAndPay.tsx
// (customer payment screen) is what actually reads this.
export function PlotSizePricingTable({ tiers }: { tiers: PlotSizeTier[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit(tier: any) {
    setEditingId(tier.id ?? 'new');
    setDraft({ ...tier });
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setDraft(null);
    setError(null);
  }

  function save() {
    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      if (draft.id) formData.set('id', draft.id);
      formData.set('min_size', String(draft.min_size ?? ''));
      formData.set('max_size', draft.max_size === '' || draft.max_size == null ? '' : String(draft.max_size));
      formData.set('extra_price', String(draft.extra_price ?? 0));
      formData.set('display_order', String(draft.display_order ?? 0));
      const result = await upsertPlotSizeTier(formData);
      if (result && 'error' in result) setError(result.error ?? null);
      else {
        cancel();
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deletePlotSizeTier(id);
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>Plot size pricing</div>
      <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 4, maxWidth: 640 }}>
        Every plan above covers the &quot;Up to&quot; band below at no extra charge — that&apos;s today&apos;s standard plot size.
        Add a band for any larger size range to charge extra on top of whichever plan the customer picks. A plot bigger
        than every band here shows &quot;contact us for a quote&quot; on the payment screen instead of a price.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 14 }}>
          <thead>
            <tr>
              {['Plot size range', 'Extra price', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px 8px 0', borderBottom: '2px solid var(--color-divider)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id} style={{ background: editingId === t.id ? 'var(--p-tint)' : 'transparent' }}>
                <td style={{ padding: '9px 10px 9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{plotSizeTierLabel(t)}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>
                  {t.extra_price > 0 ? `+₹${t.extra_price.toLocaleString('en-IN')}` : 'No extra charge'}
                </td>
                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-secondary" style={{ minHeight: 28, fontSize: 11, marginRight: 6 }} onClick={() => startEdit(t)}>
                    {editingId === t.id ? 'Editing' : 'Edit'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ minHeight: 28, fontSize: 11 }} disabled={pending} onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '10px 0', color: 'var(--p-ink-soft)' }}>No size bands yet — every plot size is priced at the plan price alone.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!draft && (
        <button type="button" className="btn btn-secondary" style={{ minHeight: 32, fontSize: 11.5, marginTop: 12 }} onClick={() => startEdit({ extra_price: 0, display_order: 0 })}>
          + Add size band
        </button>
      )}

      {draft && (
        <div style={{ border: '2px solid var(--color-accent)', padding: '16px 18px', marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15 }}>
            {editingId === 'new' || !draft.id ? 'New size band' : `Editing ${plotSizeTierLabel(draft)}`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 13 }}>
            <div className="field">
              <label>Min plot size (sq yd)</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.min_size ?? ''} onChange={(e) => setDraft({ ...draft, min_size: e.target.value })} />
            </div>
            <div className="field">
              <label>Max plot size (sq yd)</label>
              <input
                className="input"
                style={{ minHeight: 38 }}
                value={draft.max_size ?? ''}
                placeholder="Blank = no upper limit"
                onChange={(e) => setDraft({ ...draft, max_size: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Extra price (₹)</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.extra_price ?? 0} onChange={(e) => setDraft({ ...draft, extra_price: e.target.value })} />
            </div>
            <div className="field">
              <label>Display order</label>
              <input className="input" style={{ minHeight: 38 }} value={draft.display_order ?? 0} onChange={(e) => setDraft({ ...draft, display_order: e.target.value })} />
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" className="btn btn-primary" style={{ minHeight: 40, fontSize: 12.5, padding: '0 16px' }} disabled={pending} onClick={save}>
              {pending ? 'Saving…' : 'Save band'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 40, fontSize: 12.5, padding: '0 16px' }} onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
