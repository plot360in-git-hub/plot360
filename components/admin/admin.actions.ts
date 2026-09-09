'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createPendingPayment } from '@/components/payments/payments.actions';

export async function isCurrentUserAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  return !!data?.is_admin;
}

// Returns 'unauthenticated' | 'not_admin' | 'ok' so pages can send an
// unauthenticated visitor to the admin login screen specifically, rather
// than lumping them in with "logged in as a regular customer".
export async function getAdminGateStatus(): Promise<'unauthenticated' | 'not_admin' | 'ok'> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 'unauthenticated';
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  return data?.is_admin ? 'ok' : 'not_admin';
}

// Pulls everything an admin needs to make a verification decision in one place:
// the property, its ownership declaration, and its uploaded documents.
export async function getPendingProperties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('properties')
    .select('id, property_name, property_type, owner_id, status, created_at, profiles(username, first_name, last_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getPropertyForReview(propertyId: string) {
  const supabase = await createClient();
  const [{ data: property }, { data: ownership }, { data: documents }] = await Promise.all([
    supabase
      .from('properties')
      .select('*, profiles(username, first_name, last_name, email, phone_number)')
      .eq('id', propertyId)
      .single(),
    supabase.from('property_ownership').select('*').eq('property_id', propertyId).single(),
    supabase.from('property_documents').select('*').eq('property_id', propertyId),
  ]);
  return { property, ownership, documents: documents ?? [] };
}

// Removes a property entirely. Child rows (ownership declaration, documents,
// tasks, task media) cascade-delete automatically via the FK constraints in
// schema.sql. Storage files are left in place (harmless orphaned objects,
// not linked from anywhere) — fine at this scale, worth a cleanup job later.
export async function deleteProperty(propertyId: string) {
  const supabase = await createClient();

  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };

  const { error } = await supabase.from('properties').delete().eq('id', propertyId);
  if (error) return { error: error.message };

  revalidatePath('/admin');
  return { success: true };
}

export async function setPropertyStatus(propertyId: string, status: 'verified' | 'rejected', rejectionReason?: string) {
  const supabase = await createClient();

  // Belt-and-suspenders: RLS already blocks this for non-admins, but check
  // explicitly so the UI can show a clean error instead of a raw DB failure.
  if (!(await isCurrentUserAdmin())) return { error: 'Not authorized.' };

  if (status === 'rejected' && !rejectionReason?.trim()) {
    return { error: 'Please explain why the property is being rejected and what the customer needs to fix.' };
  }

  const { error } = await supabase
    .from('properties')
    .update({
      status,
      rejection_reason: status === 'rejected' ? rejectionReason!.trim() : null,
    })
    .eq('id', propertyId);
  if (error) return { error: error.message };

  // Approving content doesn't activate the property on its own anymore —
  // it now needs a completed payment. Create the pending payment record
  // the admin will confirm from the Payments page once payment comes in.
  if (status === 'verified') {
    await createPendingPayment(propertyId, 'initial');
  }

  revalidatePath('/admin');
  return { success: true };
}

// Generates a short-lived signed URL so an admin can view a private document
// without the bucket needing to be public.
export async function getDocumentSignedUrl(filePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('property-documents')
    .createSignedUrl(filePath, 60 * 5); // 5 minutes
  if (error) return null;
  return data.signedUrl;
}
