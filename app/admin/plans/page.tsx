import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getCurrentAdminContext } from '@/components/admin/admin-role.actions';
import { PlansPricingPage } from '@/components/admin/PlansPricingPage';

// Redesign 2026-09 — swapped to the new Plans & pricing screen, now
// gated server-side to the owner role (design_handoff_plot360_redesign
// requires this; previously every admin could reach this page). See
// supabase/schema.sql for the admin_role backfill that keeps every
// pre-existing admin's access unchanged. PlansSettingsPage.tsx is kept
// intact but no longer wired here — see ARCHITECTURE.md.
export default async function AdminPlansPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const ctx = await getCurrentAdminContext();
  if (!ctx.ok || ctx.role !== 'owner') redirect('/admin');

  return <PlansPricingPage />;
}
