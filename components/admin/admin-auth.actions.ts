'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Same Supabase Auth user pool as the customer login — an "admin" is just a
// profiles row with is_admin = true. This action authenticates, then checks
// that flag, and immediately signs the person back out if they're not one,
// so a regular customer can never end up with a lingering admin session.
export async function adminLogIn(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  if (!data.user) return { error: 'Login failed.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .single();

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    return { error: 'This account does not have admin access.' };
  }

  redirect('/admin');
}
