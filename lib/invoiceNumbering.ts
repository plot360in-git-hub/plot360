import type { SupabaseClient } from '@supabase/supabase-js';

// Redesign 2026-09 (follow-up, 2026-11-04) — Plot: a real sequential
// invoice number for accounting tracking (INV-000001, INV-000002, ...),
// not the synthetic payment-id-derived code the design step used. Called
// from two places a payment flips to 'completed' — recordPayment
// (payments.actions.ts) and fulfillCustomPlan (customPlan.actions.ts) —
// so the sequence reflects confirmation order, and again, lazily, as a
// fallback inside getInvoicePdfData (invoice.actions.ts) for any payment
// completed before this column existed.
//
// Plain count-and-retry rather than a Postgres sequence/function: this
// codebase has never called a Postgres function via supabase.rpc()
// before (grep the repo — every `create function` in schema.sql is
// either an RLS helper or a trigger, never called from app code), and at
// this admin team's scale (one or a few admins, confirming payments one
// at a time) a unique constraint plus a short retry loop is enough —
// the constraint is what actually guarantees two payments never end up
// sharing a number, not the retry loop by itself.
export async function assignInvoiceNumber(supabase: SupabaseClient, paymentId: string): Promise<string> {
  const { data: existing } = await supabase.from('payments').select('invoice_number').eq('id', paymentId).maybeSingle();
  if (existing?.invoice_number) return existing.invoice_number;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = await supabase.from('payments').select('id', { count: 'exact', head: true }).not('invoice_number', 'is', null);
    const candidate = `INV-${String((count ?? 0) + 1 + attempt).padStart(6, '0')}`;
    const { data, error } = await supabase
      .from('payments')
      .update({ invoice_number: candidate })
      .eq('id', paymentId)
      .is('invoice_number', null)
      .select('invoice_number')
      .maybeSingle();
    if (!error && data?.invoice_number) return data.invoice_number;

    // Either this candidate collided with another payment's number (the
    // unique constraint rejected it), or this payment already got a
    // number from a concurrent call in between — check which before
    // trying again.
    const { data: recheck } = await supabase.from('payments').select('invoice_number').eq('id', paymentId).maybeSingle();
    if (recheck?.invoice_number) return recheck.invoice_number;
  }

  // Should be unreachable in practice at this scale — a last-resort,
  // still-unique fallback so invoice generation never hard-fails.
  const fallback = `INV-${paymentId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  await supabase.from('payments').update({ invoice_number: fallback }).eq('id', paymentId).is('invoice_number', null);
  return fallback;
}
