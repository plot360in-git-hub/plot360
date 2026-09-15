'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { computeExpiryDate, remainingAfterReservations, creditToConsume } from '@/lib/visitCredits';
import type { VisitCredit } from '@/types/database.types';

// ---------- reads ----------

export async function getVisitCreditsForProperty(propertyId: string): Promise<VisitCredit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visit_credits')
    .select('*')
    .eq('property_id', propertyId)
    .order('expires_at', { ascending: true });
  return data ?? [];
}

// Batch version for the Home screen's property list (avoids one query per card).
export async function getVisitCreditsForProperties(propertyIds: string[]): Promise<Record<string, VisitCredit[]>> {
  if (propertyIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.from('visit_credits').select('*').in('property_id', propertyIds);
  const byProperty: Record<string, VisitCredit[]> = {};
  for (const row of data ?? []) {
    (byProperty[row.property_id] ??= []).push(row);
  }
  return byProperty;
}

// How many credits are already spoken for by an open/assigned request —
// see lib/visitCredits.ts, remainingAfterReservations.
export async function getOpenVisitRequestCounts(propertyIds: string[]): Promise<Record<string, number>> {
  if (propertyIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('visit_requests')
    .select('property_id')
    .in('property_id', propertyIds)
    .in('status', ['open', 'assigned']);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.property_id] = (counts[row.property_id] ?? 0) + 1;
  return counts;
}

export async function getVisitRequestsForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visit_requests')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ---------- Step 2: choose a plan and pay ----------

// Redesign 2026-09 — "Choose plan" reads real, admin-configured plans
// (components/payments/PlansSettingsPage.tsx) rather than hardcoding the
// design mock's ₹2,499/₹8,999 figures, so pricing stays a single source
// of truth. An admin should have at least one active plan with
// visit_quantity 1 and one with visit_quantity 4 for this screen to match
// the design's two options — see ARCHITECTURE.md.
export async function getActiveVisitPlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return data ?? [];
}

// UPI is simulated as instant activation — there's no live payment
// gateway wired up yet (see design_handoff_plot360_redesign/README.md,
// "Placeholders to replace"). Bank transfer records a pending payment for
// an admin to confirm, the same trust boundary the pre-redesign subscribe
// flow already used (components/payments/payments.actions.ts,
// recordPayment) — confirming one here should additionally create a
// visit_credits row, which is follow-up work for the admin console phase.
//
// Redesign 2026-09 (follow-up) — real bug Plot hit while testing: RLS on
// both `payments` (payments_insert_own requires status='pending' — only
// payments_insert_admin allows 'completed') and `visit_credits`
// (insert is admin-only, period) rejected this function's own UPI writes,
// since it ran them through the normal user-scoped client. The ownership/
// plan checks above already do the authorization a human admin would —
// this now does those two specific inserts (only those two) through the
// service-role admin client, the same pattern already used elsewhere in
// this codebase (lib/supabase/admin.ts) for a legitimately privileged
// write after manual authorization, not a way around RLS in general.
export async function purchaseVisitCredits(propertyId: string, planId: string, method: 'upi' | 'bank') {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: property } = await supabase
    .from('properties')
    .select('owner_id, property_name')
    .eq('id', propertyId)
    .single();
  if (!property || property.owner_id !== userData.user.id) return { error: 'Not authorized.' };

  const { data: plan } = await supabase.from('subscription_plans').select('*').eq('id', planId).eq('is_active', true).single();
  if (!plan) return { error: 'That plan is no longer available.' };
  const visitQuantity: number = plan.visit_quantity ?? 1;

  const { count: priorPayments } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId);
  const paymentType: 'initial' | 'renewal' = (priorPayments ?? 0) === 0 ? 'initial' : 'renewal';

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (method === 'upi') {
    const expiresAt = computeExpiryDate(today).toISOString().slice(0, 10);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: 'UPI activation is not configured on the server yet (missing SUPABASE_SERVICE_ROLE_KEY).' };
    }

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        property_id: propertyId,
        payment_type: paymentType,
        plan_id: planId,
        status: 'completed',
        amount: plan.price,
        payment_method: 'UPI',
        transaction_reference: `UPI-${Date.now()}`,
        paid_at: todayStr,
        valid_from: todayStr,
        valid_until: expiresAt,
        recorded_by: userData.user.id,
      })
      .select('id')
      .single();
    if (paymentError) return { error: paymentError.message };

    const { error: creditError } = await admin.from('visit_credits').insert({
      property_id: propertyId,
      payment_id: payment.id,
      quantity_purchased: visitQuantity,
      purchased_at: todayStr,
      expires_at: expiresAt,
    });
    if (creditError) return { error: creditError.message };

    revalidatePath('/dashboard');
    revalidatePath(`/properties/${propertyId}`);
    return {
      success: true as const,
      method: 'upi' as const,
      planName: plan.name as string,
      visitQuantity,
      amount: plan.price as number,
      expiresAt,
      propertyName: property.property_name as string,
    };
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    property_id: propertyId,
    payment_type: paymentType,
    plan_id: planId,
    status: 'pending',
    amount: plan.price,
    payment_method: 'Bank transfer',
  });
  if (paymentError) return { error: paymentError.message };

  revalidatePath('/dashboard');
  revalidatePath(`/properties/${propertyId}`);
  return {
    success: true as const,
    method: 'bank' as const,
    planName: plan.name as string,
    visitQuantity,
    amount: plan.price as number,
    propertyName: property.property_name as string,
  };
}

// ---------- Schedule a visit ----------

// Records what the customer asked for — see supabase/schema.sql,
// "Redesign 2026-09 — customer app" for why this is a visit_requests row
// rather than a monitoring_jobs insert.
export async function requestVisit(propertyId: string, windowStart: string, windowEnd: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: property } = await supabase
    .from('properties')
    .select('owner_id, status, property_name')
    .eq('id', propertyId)
    .single();
  if (!property || property.owner_id !== userData.user.id) return { error: 'Not authorized.' };
  if (property.status !== 'verified') {
    return { error: 'Not verified yet — a representative is still collecting documents for this property.' };
  }

  const credits = await getVisitCreditsForProperty(propertyId);
  const { count: reserved } = await supabase
    .from('visit_requests')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .in('status', ['open', 'assigned']);
  const remaining = remainingAfterReservations(credits, reserved ?? 0);
  if (remaining <= 0) {
    return { error: 'No visit credits remaining on this property.' };
  }

  const credit = creditToConsume(credits);

  const { data, error } = await supabase
    .from('visit_requests')
    .insert({
      property_id: propertyId,
      visit_credit_id: credit?.id ?? null,
      requested_window_start: windowStart,
      requested_window_end: windowEnd,
      requested_by: userData.user.id,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/properties/${propertyId}`);
  return {
    success: true as const,
    requestId: data.id as string,
    remainingAfter: Math.max(remaining - 1, 0),
    propertyName: property.property_name as string,
  };
}

// ---------- Redesign 2026-09 — admin console ----------

// Property verification screen, "Visit credits" panel: +30/+60/+90 days
// with a reason. "One extension per property" — enforced by refusing a
// second extension on any credit batch that's already been extended.
export async function extendVisitCredits(propertyId: string, days: number, reason: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { error: 'Only an admin can do this.' };

  if (![30, 60, 90].includes(days)) return { error: 'Choose +30, +60 or +90 days.' };
  if (!reason.trim()) return { error: 'A reason is required.' };

  const { data: batch } = await supabase
    .from('visit_credits')
    .select('id, expires_at, extension_granted')
    .eq('property_id', propertyId)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!batch) return { error: 'This property has no visit credits to extend.' };
  if (batch.extension_granted) return { error: 'This property has already had one extension.' };

  const newExpiry = new Date(batch.expires_at);
  newExpiry.setDate(newExpiry.getDate() + days);

  const { error } = await supabase
    .from('visit_credits')
    .update({
      expires_at: newExpiry.toISOString().slice(0, 10),
      extension_granted: true,
      extension_reason: reason.trim(),
      extension_days: days,
      extended_by: userData.user.id,
      extended_at: new Date().toISOString(),
    })
    .eq('id', batch.id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${propertyId}`);
  revalidatePath(`/properties/${propertyId}`);
  return { success: true, newExpiry: newExpiry.toISOString().slice(0, 10) };
}

// Property verification screen's "Visit credits" panel summary —
// most-recently-issued batch (mirrors extendVisitCredits' choice of
// "the" batch for a property).
export async function getLatestVisitCreditBatch(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('visit_credits')
    .select('*')
    .eq('property_id', propertyId)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function cancelVisitRequest(requestId: string, propertyId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('visit_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'open');
  if (error) return { error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}
