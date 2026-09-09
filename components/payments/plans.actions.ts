'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const, error: 'Only an admin can do this.' };
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

export async function getAllPlans() {
  const supabase = await createClient();
  const { data } = await supabase.from('subscription_plans').select('*').order('display_order', { ascending: true });
  return data ?? [];
}

export async function upsertPlan(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const id = String(formData.get('id') || '') || undefined;
  const name = String(formData.get('name') || '').trim();
  const price = Number(formData.get('price'));
  const validityMonths = Number(formData.get('validity_months'));
  const displayOrder = Number(formData.get('display_order')) || 0;

  if (!name) return { error: 'Plan name is required.' };
  if (!price || price <= 0) return { error: 'Enter a valid price.' };
  if (!validityMonths || validityMonths <= 0) return { error: 'Enter a valid validity period in months.' };

  const payload = { name, price, validity_months: validityMonths, display_order: displayOrder };
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

export async function updatePaymentSettings(formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { data: existing } = await gate.supabase.from('payment_settings').select('id, qr_code_image_path').limit(1).maybeSingle();

  let qrPath = existing?.qr_code_image_path ?? null;
  const qrFile = formData.get('qr_code_image') as File | null;
  if (qrFile && qrFile.size > 0) {
    const path = `qr-${Date.now()}-${qrFile.name}`;
    const { error: uploadError } = await gate.supabase.storage.from('payment-info').upload(path, qrFile, { upsert: true });
    if (uploadError) return { error: uploadError.message };
    qrPath = path;
  }

  const payload = {
    upi_id: String(formData.get('upi_id') || '') || null,
    bank_account_name: String(formData.get('bank_account_name') || '') || null,
    bank_account_number: String(formData.get('bank_account_number') || '') || null,
    bank_ifsc: String(formData.get('bank_ifsc') || '') || null,
    bank_name: String(formData.get('bank_name') || '') || null,
    qr_code_image_path: qrPath,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await gate.supabase.from('payment_settings').update(payload).eq('id', existing.id)
    : await gate.supabase.from('payment_settings').insert(payload);
  if (error) return { error: error.message };

  revalidatePath('/admin/plans');
  return { success: true };
}
