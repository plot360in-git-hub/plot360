'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createPendingPayment } from '@/components/payments/payments.actions';

// Owner-side: submits a renewal REQUEST. Does not touch properties.expiration_date —
// that only changes once an admin approves (see decideRenewal below).
export async function requestRenewal(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: property } = await supabase
    .from('properties')
    .select('status, expiration_date, owner_id')
    .eq('id', propertyId)
    .single();
  if (!property) return { error: 'Property not found.' };
  if (property.owner_id !== userData.user.id) return { error: 'Not authorized.' };
  if (property.status !== 'verified') return { error: 'Only verified properties can be renewed.' };
  if (!property.expiration_date) return { error: 'This property has no active payment period yet — nothing to renew.' };

  const daysUntilExpiry = Math.ceil((new Date(property.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const { data: latestPayment } = await supabase
    .from('payments')
    .select('valid_from')
    .eq('property_id', propertyId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let visitsCompleted = 0;
  if (latestPayment?.valid_from) {
    const { count } = await supabase
      .from('monitoring_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'approved')
      .gte('decided_at', latestPayment.valid_from);
    visitsCompleted = count ?? 0;
  }
  if (visitsCompleted < 2 || daysUntilExpiry > 15) {
    return { error: 'Renewal is not yet available — requires 2 completed site verifications and being within 15 days of expiry.' };
  }

  const { data: existingPending } = await supabase
    .from('renewal_requests')
    .select('id')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existingPending) return { error: 'A renewal request is already pending for this property.' };

  const requestedDate = String(formData.get('requested_expiration_date') || '');
  if (!requestedDate) return { error: 'Please choose a requested renewal date.' };

  const { error } = await supabase.from('renewal_requests').insert({
    property_id: propertyId,
    requested_by: userData.user.id,
    current_expiration_date: property.expiration_date,
    requested_expiration_date: requestedDate,
  });
  if (error) return { error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { success: true };
}

export async function getPendingRenewalForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('renewal_requests')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .maybeSingle();
  return data ?? null;
}

// Admin-side: list every pending renewal request across all properties.
export async function getPendingRenewals() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('renewal_requests')
    .select(
      `*,
      properties(id, property_name, property_type, plot_size, plot_size_unit, street_address, village_town, district, state, expiration_date, status),
      profiles!renewal_requests_requested_by_fkey(username, first_name, last_name, email, phone_country_code, phone_number)`
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return data ?? [];
}

// Admin decides: approve (creates a pending renewal payment — the actual
// new expiration date is only set once that payment is confirmed), or reject.
export async function decideRenewal(
  requestId: string,
  propertyId: string,
  decision: 'approved' | 'rejected',
  finalDate?: string,
  notes?: string
) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { error: 'Only an admin can decide renewal requests.' };

  const { error: requestError } = await supabase
    .from('renewal_requests')
    .update({
      status: decision,
      decided_expiration_date: decision === 'approved' ? finalDate : null,
      admin_notes: notes || null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (requestError) return { error: requestError.message };

  if (decision === 'approved') {
    const paymentResult = await createPendingPayment(propertyId, 'renewal', requestId);
    if (paymentResult?.error) return { error: paymentResult.error };
  }

  revalidatePath('/admin/renewals');
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath('/dashboard');
  return { success: true };
}
