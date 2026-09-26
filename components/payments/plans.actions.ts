'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { computePlanPrice } from '@/lib/subscription';
import { requireOwnerAdmin } from '@/components/admin/admin-role.actions';

// Redesign 2026-09 (follow-up) — Plot: confirming the owner/operations
// split actually restricts operations from Plans & pricing, not just
// hides the nav link and redirects the page. Before this, every write
// below gated on plain requireAdmin() (any admin, operations included).
// The page (app/admin/plans/page.tsx) already redirected a non-owner
// away, but Server Actions are their own reachable endpoints — an
// operations-role admin could still call upsertPlan/togglePlanActive/
// updatePaymentSettings directly and it would have succeeded (RLS
// wouldn't have stopped it either — subscription_plans_write_admin/
// payment_settings_write_admin, supabase/schema.sql, checked is_admin(),
// not the owner role, until this round). getActivePlans/getPaymentSettings/
// getPaymentQrUrl are deliberately NOT gated here at all — customers use
// them on the plan/subscribe pages before they're even an admin.
async function requireAdmin() {
  const gate = await requireOwnerAdmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const supabase = await createClient();
  return { ok: true as const, supabase };
}

export async function getActivePlans() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return data ?? [];
}

// Owner-only (unlike getActivePlans above) — this is the full catalog
// including inactive/draft plans and internal discount fields, i.e. the
// actual "Plans and pricing" data, not the public price list.
export async function getAllPlans() {
  const gate = await requireAdmin();
  if (!gate.ok) return [];
  const { data } = await gate.supabase.from('subscription_plans').select('*').order('display_order', { ascending: true });
  return data ?? [];
}

export async function upsertPlan(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get('id') || '') || undefined;
  const name = String(formData.get('name') || '').trim();
  const basePrice = Number(formData.get('base_price'));
  const discountPercent = Number(formData.get('discount_percent')) || 0;
  const renewalDiscountRaw = String(formData.get('renewal_discount_percent') || '').trim();
  const renewalDiscountPercent = renewalDiscountRaw === '' ? null : Number(renewalDiscountRaw);
  const validityMonths = Number(formData.get('validity_months'));
  const displayOrder = Number(formData.get('display_order')) || 0;
  // Redesign 2026-09 — how many site visits this plan grants (the
  // customer app's "Choose a plan" screen reads this; see
  // components/payments/visitCredits.actions.ts, getActiveVisitPlans).
  const visitQuantity = Number(formData.get('visit_quantity')) || 1;

  if (!name) return { error: 'Plan name is required.' };
  if (!basePrice || basePrice <= 0) return { error: 'Enter a valid base price.' };
  if (discountPercent < 0 || discountPercent > 100) return { error: 'Discount must be between 0 and 100.' };
  if (renewalDiscountPercent !== null && (renewalDiscountPercent < 0 || renewalDiscountPercent > 100)) {
    return { error: 'Renewal discount must be between 0 and 100.' };
  }
  if (!validityMonths || validityMonths <= 0) return { error: 'Enter a valid validity period in months.' };
  if (visitQuantity <= 0) return { error: 'Enter a valid number of visits.' };

  const payload = {
    name,
    base_price: basePrice,
    discount_percent: discountPercent,
    renewal_discount_percent: renewalDiscountPercent,
    price: computePlanPrice(basePrice, discountPercent), // kept in sync for any code still reading plan.price directly
    validity_months: validityMonths,
    display_order: displayOrder,
    visit_quantity: visitQuantity,
  };
  const { error } = id
    ? await gate.supabase.from('subscription_plans').update(payload).eq('id', id)
    : await gate.supabase.from('subscription_plans').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/admin/plans');
  return { success: true };
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const { error } = await gate.supabase.from('subscription_plans').update({ is_active: isActive }).eq('id', planId);
  if (error) return { error: error.message };
  revalidatePath('/admin/plans');
  return { success: true };
}

export async function getPaymentSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
  return data;
}

export async function getPaymentQrUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from('payment-info').getPublicUrl(filePath);
  return data.publicUrl;
}

// Redesign 2026-09 (follow-up) — signed-upload-url step for the payment
// QR code image; see lib/uploadDirect.ts and ARCHITECTURE.md #60.
export async function createPaymentQrUploadUrl(fileName: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const path = `qr-${Date.now()}-${fileName}`;
  const { data, error } = await gate.supabase.storage.from('payment-info').createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { success: true, bucket: 'payment-info' as const, path, token: data.token };
}

export async function updatePaymentSettings(formData: FormData, qrPath?: string | null) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { data: existing } = await gate.supabase.from('payment_settings').select('id, qr_code_image_path').limit(1).maybeSingle();

  const finalQrPath = qrPath ?? existing?.qr_code_image_path ?? null;

  // Redesign 2026-09 (round 32) — Accounting: the flat rate paid per
  // completed agent visit, read by getAgentPayoutSummary (accounting.
  // actions.ts) when totalling what's owed. Blank clears it back to
  // "not set" rather than 0, so an unset rate reads as "no rate
  // configured yet" instead of "agents are owed nothing".
  const payoutRateRaw = String(formData.get('agent_visit_payout_rate') || '').trim();
  const agentVisitPayoutRate = payoutRateRaw === '' ? null : Number(payoutRateRaw);
  if (agentVisitPayoutRate !== null && (Number.isNaN(agentVisitPayoutRate) || agentVisitPayoutRate < 0)) {
    return { error: 'Enter a valid agent payout rate.' };
  }

  // Redesign 2026-09 (follow-up, 2026-09-23, round 57) — Plot hit "No
  // payment account registered on Google Pay" testing the new real UPI
  // link. That's GPay saying the VPA itself isn't a real, active one
  // linked to any bank — not a code bug on our end, the deep link opened
  // correctly with the right amount/payee/note. There's no way to check
  // from here whether a VPA is genuinely active (that needs a live UPI
  // verification API, which nothing in this app has), but this at least
  // catches the more common accidental mistakes — a typo missing the
  // "@bank" part, stray spaces, a pasted phone number or email instead
  // of a VPA — before they get saved and silently break every UPI
  // payment attempt until someone notices.
  const upiIdRaw = String(formData.get('upi_id') || '').trim();
  if (upiIdRaw && !/^[\w.\-]{2,}@[a-zA-Z][\w.\-]{1,}$/.test(upiIdRaw)) {
    return { error: 'That doesn’t look like a valid UPI ID (expected a form like yourname@bank). Double-check it against your UPI app before saving.' };
  }

  const payload = {
    upi_id: upiIdRaw || null,
    bank_account_name: String(formData.get('bank_account_name') || '') || null,
    bank_account_number: String(formData.get('bank_account_number') || '') || null,
    bank_ifsc: String(formData.get('bank_ifsc') || '') || null,
    bank_name: String(formData.get('bank_name') || '') || null,
    qr_code_image_path: finalQrPath,
    agent_visit_payout_rate: agentVisitPayoutRate,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await gate.supabase.from('payment_settings').update(payload).eq('id', existing.id)
    : await gate.supabase.from('payment_settings').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/admin/plans');
  revalidatePath('/admin/accounting');
  return { success: true };
}
