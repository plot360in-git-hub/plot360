import { createClient } from '@/lib/supabase/server';
import { getVisitCreditsForProperties, getReservedCreditCounts } from '@/components/payments/visitCredits.actions';

// Redesign 2026-09 — data for the new customer Home screen
// (components/customer/CustomerHome.tsx). Deliberately a new loader
// rather than extending components/dashboard/dashboard.data.ts, which
// keeps serving the pre-redesign CustomerDashboard unchanged.
export async function getCustomerHomeData() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: profile }, { data: properties }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userData.user.id).single(),
    supabase
      .from('properties')
      .select('id, property_name, status, registration_date, street_address, expiration_date, rejection_reason')
      .eq('owner_id', userData.user.id)
      .order('created_at', { ascending: false }),
  ]);

  const propertyIds = (properties ?? []).map((p) => p.id);

  const [creditsByProperty, reservedByProperty, { data: monitoringJobs }, { data: openVisitRequests }] = await Promise.all([
    getVisitCreditsForProperties(propertyIds),
    getReservedCreditCounts(propertyIds),
    propertyIds.length > 0
      ? supabase
          .from('monitoring_jobs')
          .select('id, status, property_id, visit_number, decided_at, assigned_at')
          .in('property_id', propertyIds)
          .order('assigned_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    // Redesign 2026-09 (follow-up, round 29) — Plot: a visit the customer
    // just scheduled showed its chip as "Unused" instead of "Scheduled".
    // A newly scheduled visit is only a visit_requests row (requestVisit,
    // visitCredits.actions.ts) until an admin actually assigns an agent —
    // that's the point it becomes a monitoring_jobs row with a
    // visit_number, which is all visitChips() below previously had to go
    // on. This fetches the still-open (not yet assigned) requests per
    // property so CustomerHome can count them as "Scheduled" too, not
    // just admin-assigned ones.
    propertyIds.length > 0
      ? supabase.from('visit_requests').select('id, property_id').in('property_id', propertyIds).eq('status', 'open')
      : Promise.resolve({ data: [] }),
  ]);

  const jobsByProperty: Record<string, any[]> = {};
  for (const job of monitoringJobs ?? []) {
    (jobsByProperty[job.property_id] ??= []).push(job);
  }

  const openRequestCountByProperty: Record<string, number> = {};
  for (const r of openVisitRequests ?? []) {
    openRequestCountByProperty[r.property_id] = (openRequestCountByProperty[r.property_id] ?? 0) + 1;
  }

  return {
    profile,
    properties: properties ?? [],
    creditsByProperty,
    reservedByProperty,
    jobsByProperty,
    openRequestCountByProperty,
  };
}

// Masks a phone number the way the design's poster header does: first 4
// digits, dots, last 2 — e.g. "9848 ••• 21".
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 4)} ••• ${digits.slice(-2)}`;
}
