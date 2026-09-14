'use server';

import { createClient } from '@/lib/supabase/server';

// Backs the landing page's "Request a call back" form (design_handoff
// redesign — Landing, #contact). Public and unauthenticated: anyone can
// submit, only an admin can read (see the enquiries_insert_public /
// enquiries_select_admin RLS policies added in
// supabase/schema.sql "Redesign 2026-09 — foundation").
export async function submitEnquiry(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const mobile = String(formData.get('mobile') || '').trim();
  const plotLocation = String(formData.get('plot_location') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (!name) return { error: 'Please tell us your name.' };
  if (!mobile) return { error: 'Please share a mobile number so we can call you back.' };

  const supabase = await createClient();
  const { error } = await supabase.from('enquiries').insert({
    name,
    mobile,
    plot_location: plotLocation || null,
    notes: notes || null,
  });

  if (error) return { error: 'Could not send your request — please try again or reach us on WhatsApp.' };

  return { success: true };
}
