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

// How many credits are already spoken for by activity in progress — see
// lib/visitCredits.ts, remainingAfterReservations.
//
// Redesign 2026-09 (follow-up, round 20) — this used to count only
// visit_requests with status 'open' or 'assigned'. That missed any
// monitoring_jobs row holding a visit_credit_id that didn't come from a
// visit_request at all — specifically round 19's auto-assigned first
// visit, but really any job assigned straight from the admin's Job
// assignment queue. Now counts two buckets that never overlap: a
// visit_request still 'open' (the customer's ask hasn't become a job
// yet), and any monitoring_jobs row already holding a visit_credit_id
// that hasn't reached a final, credit-consuming outcome yet ('approved'
// is what actually decrements the credit — see finalizeApprovedJob,
// monitoring.actions.ts — so an approved job is correctly excluded
// here and picked up instead by quantity_used). The moment a
// visit_request becomes a job (assignAgentToTarget flips it to
// status='assigned' and creates the job), it drops out of the first
// bucket and its job picks it up in the second — never double-counted.
export async function getReservedCreditCounts(propertyIds: string[]): Promise<Record<string, number>> {
  if (propertyIds.length === 0) return {};
  const supabase = await createClient();
  const [{ data: openRequests }, { data: inProgressJobs }] = await Promise.all([
    supabase.from('visit_requests').select('property_id').in('property_id', propertyIds).eq('status', 'open'),
    supabase
      .from('monitoring_jobs')
      .select('property_id')
      .in('property_id', propertyIds)
      .not('visit_credit_id', 'is', null)
      .in('status', ['assigned', 'accepted', 'submitted', 'ec_pending', 'rejected']),
  ]);
  const counts: Record<string, number> = {};
  for (const row of openRequests ?? []) counts[row.property_id] = (counts[row.property_id] ?? 0) + 1;
  for (const row of inProgressJobs ?? []) counts[row.property_id] = (counts[row.property_id] ?? 0) + 1;
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
// Redesign 2026-09 (follow-up) — Plot asked for an optional "Payment
// transaction ID" field on the customer payment screen (ChoosePlanAndPay.tsx)
// so a customer paying by real UPI/bank transfer can hand the admin the
// actual reference their bank/UPI app gave them, instead of relying only
// on the UPI branch's own generated placeholder (which isn't a real
// transaction id — there's no live payment gateway here, see the comment
// a few lines down) or the bank branch, which previously stored no
// reference at all until an admin filled one in later via
// PaymentRecordForm. Optional — customerTransactionId may be blank.
export async function purchaseVisitCredits(propertyId: string, planId: string, method: 'upi' | 'bank', customerTransactionId?: string) {
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

    // Prefer whatever the customer typed in (their real UPI reference) —
    // fall back to the generated placeholder only when they left it blank.
    const transactionReference = customerTransactionId?.trim() || `UPI-${Date.now()}`;

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        property_id: propertyId,
        payment_type: paymentType,
        plan_id: planId,
        status: 'completed',
        amount: plan.price,
        payment_method: 'UPI',
        transaction_reference: transactionReference,
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

    // Redesign 2026-09 (follow-up, round 19) — real bug Plot hit: a
    // property paid for through this instant-UPI path never got
    // properties.expiration_date set (only recordPayment, the admin
    // bank-transfer confirmation path, did that), and
    // getEligiblePropertiesForAssignment (monitoring.actions.ts) — the
    // "legacy" Job assignment source, which already has "the first visit
    // of a cycle is eligible immediately on payment, no due-date wait"
    // built in — filters on `expiration_date is not null`. So a property
    // paid via UPI just sat there: verified, paid, credits issued, but
    // invisible to Job assignment, leaving "Schedule a visit" as the only
    // apparent next step even for a brand-new property's first visit.
    // Setting expiration_date here (matching what recordPayment does for
    // the same paymentType==='initial' case) makes it flow through that
    // same existing mechanism instead of building a second one.
    // Deliberately NOT setting next_monitoring_due_date here (unlike
    // recordPayment's legacy branch) — that column is what lets
    // getEligiblePropertiesForAssignment auto-surface a property's
    // SECOND+ visit once a due-date window opens, with no customer
    // action. For these visit-credit-based plans (1, 4, or any other
    // purchased quantity) every visit after the first should only ever
    // appear once the customer explicitly schedules it (ScheduleVisit ->
    // requestVisit -> visit_requests -> the "visit_request" Job
    // assignment source) — leaving next_monitoring_due_date null keeps
    // this property out of the legacy auto-surface path for anything
    // past its first visit.
    const { error: propertyError } = await admin
      .from('properties')
      .update({ expiration_date: expiresAt })
      .eq('id', propertyId);
    if (propertyError) return { error: propertyError.message };

    revalidatePath('/dashboard');
    revalidatePath(`/properties/${propertyId}`);
    revalidatePath('/admin/queue/job-assignment');
    return {
      success: true as const,
      method: 'upi' as const,
      planName: plan.name as string,
      visitQuantity,
      amount: plan.price as number,
      // Redesign 2026-09 (follow-up, round 2) — the "done" screen's rows
      // table (ConfirmationScreen.tsx) shows this as "Reference"; it used
      // to be written to the payments row and then dropped on the floor.
      reference: transactionReference,
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
    // Was previously always left null here — an admin only ever set it
    // later via PaymentRecordForm's own "Transaction / reference number"
    // field when confirming the transfer. Now pre-filled from what the
    // customer entered, if anything, so the admin sees it immediately
    // (PaymentRecordForm's defaultReference already reads this column).
    transaction_reference: customerTransactionId?.trim() || null,
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
  // Redesign 2026-09 (follow-up, round 20) — used to count only this
  // property's own open/assigned visit_requests, which missed a credit
  // already tied up by an in-progress job that didn't come from a
  // visit_request at all (round 19's auto-assigned first visit, or any
  // job the admin assigned straight from Job assignment). Sharing
  // getReservedCreditCounts with the read-side screens keeps this gate
  // and what the customer sees as "remaining" in agreement.
  const reservedCounts = await getReservedCreditCounts([propertyId]);
  const reserved = reservedCounts[propertyId] ?? 0;
  const remaining = remainingAfterReservations(credits, reserved);
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
