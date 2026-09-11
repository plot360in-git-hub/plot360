'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendNotificationEmail } from '@/lib/email';
import { computePlanPrice, effectiveDiscountPercent } from '@/lib/subscription';

export async function getMyPendingPaymentForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('*, subscription_plans(name, price)')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function submitSubscriptionPayment(propertyId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: property } = await supabase.from('properties').select('owner_id, status, property_name').eq('id', propertyId).single();
  if (!property) return { error: 'Property not found.' };
  if (property.owner_id !== userData.user.id) return { error: 'Not authorized.' };
  if (property.status !== 'verified') return { error: 'This property must be verified by admin before subscribing.' };

  const planId = String(formData.get('plan_id') || '');
  const paymentMethod = String(formData.get('payment_method') || '');
  const transactionId = String(formData.get('transaction_id') || '').trim();
  if (!planId) return { error: 'Please select a plan.' };
  if (!paymentMethod) return { error: 'Please select how you paid.' };
  if (!transactionId) return { error: 'Transaction ID is required.' };

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('price, base_price, discount_percent, renewal_discount_percent')
    .eq('id', planId)
    .single();

  const { data: existingPending } = await supabase
    .from('payments')
    .select('id, payment_type')
    .eq('property_id', propertyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isRenewal = existingPending?.payment_type === 'renewal';
  const amount = plan
    ? computePlanPrice(plan.base_price ?? plan.price, effectiveDiscountPercent(plan, isRenewal))
    : null;

  let paymentId = existingPending?.id as string | undefined;
  if (!paymentId) {
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert({ property_id: propertyId, payment_type: 'initial', status: 'pending' })
      .select('id')
      .single();
    if (insertError) return { error: insertError.message };
    paymentId = newPayment.id;
  }

  let screenshotPath: string | null = null;
  const screenshotFile = formData.get('screenshot') as File | null;
  if (screenshotFile && screenshotFile.size > 0) {
    const path = `${paymentId}/${Date.now()}-${screenshotFile.name}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(path, screenshotFile);
    if (uploadError) return { error: uploadError.message };
    screenshotPath = path;
  }

  const { data: updated, error } = await supabase
    .from('payments')
    .update({
      plan_id: planId,
      amount,
      payment_method: paymentMethod,
      transaction_reference: transactionId,
      ...(screenshotPath ? { screenshot_path: screenshotPath } : {}),
    })
    .eq('id', paymentId)
    .select('id')
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) {
    // RLS silently matched zero rows — Supabase doesn't treat this as an
    // error by default, so without this explicit check the customer would
    // see "success" while nothing was actually saved.
    return { error: 'Could not save your submission — please contact support.' };
  }

  if (userData.user.email) {
    await sendNotificationEmail({
      to: userData.user.email,
      subject: `Payment proof received — ${property.property_name}`,
      heading: 'We received your payment proof',
      bodyLines: [
        `Thanks — we've received your Transaction ID for "${property.property_name}".`,
        'An admin will verify it shortly and confirm your subscription. You\'ll get another email once that\'s done.',
      ],
    });
  }

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/properties/${propertyId}/subscribe`);
  return { success: true };
}
