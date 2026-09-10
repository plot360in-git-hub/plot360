import { createClient } from '@/lib/supabase/server';
import { getLatestPaymentsForProperties } from '@/components/payments/payments.actions';
import { maxVisitsForPlan } from '@/lib/subscription';

export async function getDashboardData() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const [{ data: profile }, { data: properties }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userData.user.id).single(),
    supabase
      .from('properties')
      .select('id, property_name, status, registration_date, expiration_date, rejection_reason')
      .eq('owner_id', userData.user.id)
      .order('created_at', { ascending: false }),
  ]);

  const propertyIds = (properties ?? []).map((p) => p.id);

  const [{ data: tasks }, { data: monitoringJobs }, { data: approvedVisits }, paymentsByProperty] = await Promise.all([
    propertyIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, task_name, status, start_date, property_id, properties(property_name)')
          .in('property_id', propertyIds)
          .neq('status', 'complete')
          .order('start_date', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? supabase
          .from('monitoring_jobs')
          .select('id, status, assigned_at, property_id, properties(property_name)')
          .in('property_id', propertyIds)
          .order('assigned_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    propertyIds.length > 0
      ? supabase
          .from('monitoring_jobs')
          .select('property_id, decided_at')
          .in('property_id', propertyIds)
          .eq('status', 'approved')
      : Promise.resolve({ data: [] }),
    getLatestPaymentsForProperties(propertyIds),
  ]);

  // Count approved visits since the CURRENT payment cycle started, same
  // logic as the admin's assignment eligibility check — resets each renewal.
  const visitCountByProperty: Record<string, number> = {};
  for (const job of approvedVisits ?? []) {
    const cycleStart = paymentsByProperty?.[job.property_id]?.valid_from;
    if (!job.decided_at || !cycleStart) continue;
    if (new Date(job.decided_at) >= new Date(cycleStart)) {
      visitCountByProperty[job.property_id] = (visitCountByProperty[job.property_id] ?? 0) + 1;
    }
  }

  // Latest monitoring job per property (any status) — powers the new
  // "Monitoring" dashboard column, replacing the old bottom section.
  const latestMonitoringByProperty: Record<string, string> = {};
  for (const job of [...(monitoringJobs ?? [])].sort(
    (a: any, b: any) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime()
  )) {
    if (!latestMonitoringByProperty[job.property_id]) latestMonitoringByProperty[job.property_id] = job.status;
  }

  const total = properties?.length ?? 0;
  const verified = properties?.filter((p) => p.status === 'verified').length ?? 0;
  const pending = total - verified;

  const maxVisitsByProperty: Record<string, number> = {};
  for (const id of propertyIds) {
    const plan: any = paymentsByProperty?.[id]?.subscription_plans;
    maxVisitsByProperty[id] = maxVisitsForPlan(plan?.validity_months);
  }

  return {
    profile,
    properties: properties ?? [],
    paymentsByProperty,
    upcomingTasks: tasks ?? [],
    monitoringJobs: monitoringJobs ?? [],
    latestMonitoringByProperty,
    visitCountByProperty,
    maxVisitsByProperty,
    summary: { total, verified, pending },
  };
}
