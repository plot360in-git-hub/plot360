'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const, error: 'Only an admin can do this.' };
  return { ok: true as const, supabase, userId: userData.user.id };
}

// The single most relevant payment record for a property — used by the
// customer dashboard and property view to show "Payment: Pending/Completed".
export async function getLatestPaymentForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// Batch version for the dashboard's property table (avoids one query per row).
export async function getLatestPaymentsForProperties(propertyIds: string[]) {
  if (propertyIds.length === 0) return {} as Record<string, any>;
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('*')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false });

  const latestByProperty: Record<string, any> = {};
  for (const payment of data ?? []) {
    if (!latestByProperty[payment.property_id]) latestByProperty[payment.property_id] = payment;
  }
  return latestByProperty;
}

// Called when an admin approves a property's verification, or approves a
// renewal request — creates the pending payment record the customer then
// needs to complete before the property (re)activates.
export async function createPendingPayment(
  propertyId: string,
  paymentType: 'initial' | 'renewal',
  renewalRequestId?: string
) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  // Avoid creating a duplicate pending payment if one's already outstanding.
  const { data: existingPending } = await gate.supabase
    .from('payments')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingPending) return { success: true, paymentId: existingPending.id };

  const { data, error } = await gate.supabase
    .from('payments')
    .insert({
      property_id: propertyId,
      payment_type: paymentType,
      renewal_request_id: renewalRequestId ?? null,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/properties/${propertyId}`);
  return { success: true, paymentId: data.id };
}

// Admin-side lists for the Payments page.
export async function getPendingPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('*, properties(id, property_name, owner_id, profiles(username, first_name, last_name, email))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getCompletedPayments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('*, properties(id, property_name, owner_id, profiles(username, first_name, last_name, email))')
    .eq('status', 'completed')
    .order('valid_until', { ascending: true });
  return data ?? [];
}

// Completed payments whose validity is about to lapse — the admin's
// reminder list for reaching out to customers ahead of expiration.
export async function getUpcomingRenewalsDue(daysAhead = 30) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  const { data } = await supabase
    .from('payments')
    .select('*, properties(id, property_name, owner_id, profiles(username, first_name, last_name, email))')
    .eq('status', 'completed')
    .lte('valid_until', cutoff.toISOString().slice(0, 10))
    .order('valid_until', { ascending: true });
  return data ?? [];
}

// The core confirmation step: admin records how payment was received and
// marks it completed. This is what actually sets the property's live
// validity window — nothing before this point extends expiration_date.
export async function recordPayment(paymentId: string, propertyId: string, formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const supabase = gate.supabase;

  const paidAt = String(formData.get('paid_at') || '') || new Date().toISOString().slice(0, 10);
  const paymentMethod = String(formData.get('payment_method') || '').trim();
  const transactionReference = String(formData.get('transaction_reference') || '').trim();
  const amount = formData.get('amount') ? Number(formData.get('amount')) : null;
  const notes = String(formData.get('notes') || '') || null;

  if (!paymentMethod) return { error: 'Payment method is required.' };

  const validFrom = paidAt;
  const validUntilDate = new Date(paidAt);
  validUntilDate.setFullYear(validUntilDate.getFullYear() + 1);
  const validUntil = validUntilDate.toISOString().slice(0, 10);

  const { data: paymentRow } = await supabase.from('payments').select('payment_type').eq('id', paymentId).single();

  const { error: paymentError } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      payment_method: paymentMethod,
      transaction_reference: transactionReference || null,
      amount,
      notes,
      paid_at: paidAt,
      valid_from: validFrom,
      valid_until: validUntil,
      recorded_by: gate.userId,
    })
    .eq('id', paymentId);
  if (paymentError) return { error: paymentError.message };

  const propertyPatch: Record<string, unknown> = { expiration_date: validUntil };
  // First payment starts the twice-yearly monitoring clock; renewal
  // payments don't reset it — that's driven by each monitoring job's
  // own approval instead (see decideMonitoringJob).
  if (paymentRow?.payment_type === 'initial') {
    const firstMonitoringDue = new Date(paidAt);
    firstMonitoringDue.setMonth(firstMonitoringDue.getMonth() + 6);
    propertyPatch.next_monitoring_due_date = firstMonitoringDue.toISOString().slice(0, 10);
  }

  const { error: propertyError } = await supabase
    .from('properties')
    .update(propertyPatch)
    .eq('id', propertyId);
  if (propertyError) return { error: propertyError.message };

  revalidatePath('/admin/payments');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/dashboard');
  return { success: true, validUntil };
}
