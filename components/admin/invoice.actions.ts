'use server';

import { createClient } from '@/lib/supabase/server';
import { assignInvoiceNumber } from '@/lib/invoiceNumbering';
import type { InvoiceData } from '@/lib/pdf/invoicePdf';

// Redesign 2026-09 (follow-up, 2026-11-04) — invoice generation, step 2.
// Admin-only, same gate every other admin action in this file's sibling
// modules uses — this is called straight from the invoice route handler
// (app/admin/payments/[id]/invoice/route.ts), which isn't covered by
// app/admin/layout.tsx's gate (layouts don't wrap route handlers, same
// reasoning as the visit-report PDF route), so this gates itself too
// rather than trusting the caller.
async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const };
  return { ok: true as const, supabase };
}

// Assembles everything lib/pdf/invoicePdf.ts's buildInvoicePdf needs for
// one completed payment — works the same for a catalog plan or a custom
// plan (visit_credits is the one place both store "how many visits were
// actually issued", see schema.sql; subscription_plans.visit_quantity
// only applies to catalog plans). Returns null for "nothing to show"
// (not found, not an admin, or the payment isn't completed yet — there's
// no such thing as an invoice for a payment still pending) so the route
// handler can turn that into a plain 404.
export async function getInvoicePdfData(paymentId: string): Promise<InvoiceData | null> {
  const gate = await requireAdmin();
  if (!gate.ok) return null;
  const supabase = gate.supabase;

  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, status, amount, payment_method, transaction_reference, paid_at, valid_from, valid_until, payment_type, is_custom_plan, invoice_number, property_id, subscription_plans(name), properties(id, property_name, village_town, district, state, owner_id, profiles(first_name, last_name, email, phone_country_code, phone_number))'
    )
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment || payment.status !== 'completed') return null;

  // Every payment is assigned a real invoice number the moment it's
  // confirmed (recordPayment / fulfillCustomPlan, via
  // lib/invoiceNumbering.ts) — this lazy fallback only matters for a
  // payment that completed before the invoice_number column existed.
  const invoiceNumber = payment.invoice_number ?? (await assignInvoiceNumber(supabase, paymentId));

  const { data: credit } = await supabase
    .from('visit_credits')
    .select('quantity_purchased')
    .eq('payment_id', paymentId)
    .maybeSingle();

  const property: any = (payment as any).properties;
  const profile: any = property?.profiles;
  const plan: any = (payment as any).subscription_plans;

  const addressLine = [property?.village_town, property?.district, property?.state].filter(Boolean).join(', ');
  const customerName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Property owner';

  // One line item for the total actually paid — no attempt to split a
  // catalog-plan payment into a base price + plot-size-surcharge line,
  // since payments only stores the final confirmed amount (whatever the
  // admin entered), not a breakdown; inventing a split here could show
  // the customer numbers that don't actually reconcile.
  const description = payment.is_custom_plan
    ? `Custom visit plan — ${property?.property_name ?? 'property'}`
    : `${plan?.name ?? 'Visit plan'}${payment.payment_type === 'renewal' ? ' (renewal)' : ''}`;

  return {
    payment: {
      id: payment.id,
      invoiceNumber,
      paidAt: payment.paid_at,
      paymentMethod: payment.payment_method,
      transactionReference: payment.transaction_reference,
      amount: payment.amount ?? 0,
      isCustomPlan: payment.is_custom_plan,
      paymentType: payment.payment_type,
      validFrom: payment.valid_from,
      validUntil: payment.valid_until,
    },
    lineItems: [{ description, amount: payment.amount ?? 0 }],
    visitQuantity: credit?.quantity_purchased ?? null,
    property: {
      id: property?.id ?? payment.property_id,
      name: property?.property_name ?? 'Property',
      addressLine,
    },
    customer: {
      name: customerName,
      email: profile?.email ?? null,
      phoneCountryCode: profile?.phone_country_code ?? null,
      phoneNumber: profile?.phone_number ?? null,
    },
  };
}
