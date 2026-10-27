'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait, isLate, matchesQuery, paginate, PAGE_SIZE } from '@/lib/adminQueue';
import { logAdminAction } from './timeline.actions';
import type { QueueRow } from './queues.actions';

// Redesign 2026-09 (follow-up, 2026-10-03) — custom visit plans, admin
// half. See supabase/schema.sql's note on payments.is_custom_plan and
// components/payments/visitCredits.actions.ts's requestCustomPlan for
// the customer-facing half. Deliberately NOT built on top of
// recordPayment (payments.actions.ts) — that function derives both the
// visit quantity and the validity period from a subscription_plans row
// (plan.visit_quantity / plan.validity_months), which a custom plan by
// definition doesn't have; admin enters both directly here instead.

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const, error: 'Only an admin can do this.' };
  return { ok: true as const, supabase, userId: userData.user.id };
}

// Admin queue list — "customers who asked for a custom plan, not yet
// set up". Mirrors getPaymentsQueue's shape (queues.actions.ts) but
// reads its own is_custom_plan + status='pending' slice, which that
// query deliberately excludes (see its own note). Links straight into
// the property's own admin page (/admin/[id]) rather than a separate
// detail route — that page already has the "Custom plan" panel
// (PropertyVerificationDetail.tsx) where the request is actually filled
// in, so a second detail screen would just be a redundant stop in
// between.
export async function getCustomPlanQueue(opts: { query?: string; page?: number } = {}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('id, created_at, properties(id, property_name, profiles(first_name, last_name, username, email))')
    .eq('is_custom_plan', true)
    .eq('status', 'pending')
    // Redesign 2026-09 (follow-up, 2026-10-03, round 2) — a declined
    // request stays status='pending' (see schema.sql's note on
    // custom_plan_declined_at) but should no longer show up here.
    .is('custom_plan_declined_at', null)
    .order('created_at', { ascending: true });

  const rows: Omit<QueueRow, 'wait' | 'late'>[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.properties?.property_name ?? 'Property',
    place: profileDisplayName(p.properties?.profiles),
    state: 'Waiting for a call back',
    urgent: false,
    window: '—',
    waitHours: hoursSince(p.created_at),
    href: `/admin/${p.properties?.id}`,
  }));

  const filtered = rows.filter((r) => matchesQuery([r.name, r.place, r.state], opts.query ?? ''));
  filtered.sort((a, b) => b.waitHours - a.waitHours);
  const withWait: QueueRow[] = filtered.map((r) => ({ ...r, wait: formatWait(r.waitHours), late: isLate(r.waitHours) }));
  return paginate(withWait, opts.page ?? 1, PAGE_SIZE);
}

// Property admin page — the one pending custom-plan request against
// this property, if any (there should only ever be one at a time;
// requestCustomPlan refuses to create a second while one is already
// pending).
export async function getPendingCustomPlanRequest(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('id, created_at')
    .eq('property_id', propertyId)
    .eq('is_custom_plan', true)
    .eq('status', 'pending')
    .is('custom_plan_declined_at', null)
    .maybeSingle();
  return data ?? null;
}

// Redesign 2026-09 (follow-up, 2026-10-03, round 2) — Plot asked for a
// way to decline/dismiss a request the admin isn't going to pursue
// (customer went quiet, decided against it, etc.), rather than only
// being able to fulfill one. Leaves the row itself alone otherwise — it
// stays a real record of "this customer asked, on this date, and we
// declined it" rather than being deleted — just stamps
// custom_plan_declined_at so getCustomPlanQueue/getPendingCustomPlanRequest
// (and the dashboard tile count) stop surfacing it. No WhatsApp here —
// unlike fulfilling one, there's no agreed plan to confirm to the
// customer; if admin wants to tell them, that's a phone call, same as
// how they got the custom-plan conversation started in the first place.
export async function declineCustomPlanRequest(paymentId: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { data: payment } = await gate.supabase
    .from('payments')
    .select('id, property_id, is_custom_plan, status, custom_plan_declined_at')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment || !payment.is_custom_plan) return { error: 'Custom plan request not found.' };
  if (payment.status !== 'pending' || payment.custom_plan_declined_at) {
    return { error: 'This request is no longer pending.' };
  }

  const { error } = await gate.supabase
    .from('payments')
    .update({ custom_plan_declined_at: new Date().toISOString() })
    .eq('id', paymentId)
    .eq('is_custom_plan', true);
  if (error) return { error: error.message };

  await logAdminAction({ entityType: 'payment', entityId: paymentId, action: 'Custom plan request declined' });

  revalidatePath('/admin/queue/custom-plans');
  revalidatePath(`/admin/${payment.property_id}`);
  revalidatePath('/dashboard');
  revalidatePath(`/properties/${payment.property_id}`);
  return { success: true as const };
}

// The core action — fills in (or creates outright, if an admin sets one
// up proactively with no prior customer request) a custom plan for one
// property: a negotiated rate, a visit count, and a validity period,
// recorded exactly like any other completed payment + visit_credits
// batch everywhere else in the app reads them.
//
// existingPaymentId: pass the pending request's id (getPendingCustomPlanRequest)
// to fulfill it in place, preserving when the customer first asked;
// omit it for a proactive custom plan with no prior request — a new,
// already-completed payments row is inserted directly.
export async function fulfillCustomPlan(propertyId: string, formData: FormData, existingPaymentId?: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const supabase = gate.supabase;

  const amount = Number(formData.get('amount'));
  const visitQuantity = Number(formData.get('visit_quantity'));
  const validityMonths = Number(formData.get('validity_months')) || 12;
  const paymentMethod = String(formData.get('payment_method') || '').trim();
  const paidAt = String(formData.get('paid_at') || '') || new Date().toISOString().slice(0, 10);
  const transactionReference = String(formData.get('transaction_reference') || '').trim() || null;
  // Free-text description of what was agreed ("Monthly visits × 6",
  // "20 visits, paid by cheque") — reuses payments.notes rather than a
  // new column, same field PaymentRecordForm already uses for this.
  const notes = String(formData.get('notes') || '').trim() || null;

  if (!amount || amount <= 0) return { error: 'Enter the agreed amount.' };
  if (!visitQuantity || visitQuantity <= 0) return { error: 'Enter how many visits were agreed.' };
  if (!validityMonths || validityMonths <= 0) return { error: 'Enter a valid validity period in months.' };
  if (!paymentMethod) return { error: 'Payment method is required.' };

  const validFrom = paidAt;
  const validUntilDate = new Date(paidAt);
  validUntilDate.setMonth(validUntilDate.getMonth() + validityMonths);
  const validUntil = validUntilDate.toISOString().slice(0, 10);

  let paymentId = existingPaymentId;

  if (existingPaymentId) {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        amount,
        payment_method: paymentMethod,
        transaction_reference: transactionReference,
        notes,
        paid_at: paidAt,
        valid_from: validFrom,
        valid_until: validUntil,
        recorded_by: gate.userId,
      })
      .eq('id', existingPaymentId)
      .eq('is_custom_plan', true);
    if (error) return { error: error.message };
  } else {
    const { count: priorPayments } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId);
    const paymentType: 'initial' | 'renewal' = (priorPayments ?? 0) === 0 ? 'initial' : 'renewal';

    const { data: inserted, error } = await supabase
      .from('payments')
      .insert({
        property_id: propertyId,
        payment_type: paymentType,
        status: 'completed',
        is_custom_plan: true,
        amount,
        payment_method: paymentMethod,
        transaction_reference: transactionReference,
        notes,
        paid_at: paidAt,
        valid_from: validFrom,
        valid_until: validUntil,
        recorded_by: gate.userId,
      })
      .select('id')
      .single();
    if (error) return { error: error.message };
    paymentId = inserted.id;
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .update({ expiration_date: validUntil })
    .eq('id', propertyId)
    .select('property_name')
    .single();
  if (propertyError) return { error: propertyError.message };

  // Guard against double-issue if this is ever submitted twice for the
  // same payment (e.g. a slow network retry) — same guard recordPayment
  // uses for the catalog-plan path.
  const { data: existingCredit } = await supabase.from('visit_credits').select('id').eq('payment_id', paymentId).maybeSingle();
  if (!existingCredit) {
    const { error: creditError } = await supabase.from('visit_credits').insert({
      property_id: propertyId,
      payment_id: paymentId,
      quantity_purchased: visitQuantity,
      purchased_at: paidAt,
      expires_at: validUntil,
    });
    if (creditError) return { error: creditError.message };
  }

  revalidatePath('/admin/queue/custom-plans');
  revalidatePath(`/admin/${propertyId}`);
  revalidatePath('/dashboard');
  revalidatePath(`/properties/${propertyId}`);
  return {
    success: true as const,
    paymentId: paymentId as string,
    validUntil,
    amount,
    visitQuantity,
    propertyName: (property?.property_name as string) ?? 'the property',
  };
}
