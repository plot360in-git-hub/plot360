'use server';

import { createClient } from '@/lib/supabase/server';
import { hoursSince, isLate } from '@/lib/adminQueue';
import { getLegacyAssignmentTargets, getVisitRequestAssignmentTargets, getStuckAssignmentTargets } from './assignment.actions';

// Redesign 2026-09 — admin console Dashboard ("Waiting on you" — badge
// tiles with counts + "N past 24h", plus Failed WhatsApp messages).
// Replaces the old AdminHeader's flat nav badge counts (still available,
// unreferenced) with real per-queue late-counts, which didn't exist
// before this phase.
export type DashboardTile = {
  id: string;
  label: string;
  count: number;
  late: number;
  note: string;
  href: string;
};

export async function getDashboardTiles(): Promise<DashboardTile[]> {
  const supabase = await createClient();

  const [{ data: pendingProps }, legacyTargets, visitRequestTargets, stuckTargets, { data: submittedJobs }, { data: pendingAgents }, { data: openRequests }, { data: pendingPayments }] =
    await Promise.all([
      supabase.from('properties').select('created_at').eq('status', 'pending'),
      getLegacyAssignmentTargets(),
      getVisitRequestAssignmentTargets(),
      getStuckAssignmentTargets(),
      supabase.from('monitoring_jobs').select('submitted_at').eq('status', 'submitted'),
      supabase.from('agent_profiles').select('created_at').eq('status', 'pending'),
      supabase.from('service_requests').select('updated_at').eq('status', 'open'),
      supabase.from('payments').select('created_at').eq('status', 'pending'),
    ]);

  const lateCount = (items: (string | null | undefined)[]) => items.filter((iso) => isLate(hoursSince(iso))).length;

  // Stuck (reassignment-needed) jobs are always counted late — they've
  // already sat unassigned/undone past the point reassignMonitoringJob
  // considers normal, so they should never look "fresh" on the tile.
  const assignmentWaits = [
    ...legacyTargets.map((t: any) => (t.dueDate ? t.dueDate : null)),
    ...visitRequestTargets.map((t: any) => t.createdAt),
  ];

  return [
    {
      id: 'qProperty',
      label: 'Property verification',
      count: pendingProps?.length ?? 0,
      late: lateCount((pendingProps ?? []).map((p) => p.created_at)),
      note: 'Documents and owner approval',
      href: '/admin/queue/property-verification',
    },
    {
      id: 'qAssign',
      label: 'Job assignment',
      count: legacyTargets.length + visitRequestTargets.length + stuckTargets.length,
      late: lateCount(assignmentWaits) + stuckTargets.length,
      note: 'Paid, waiting for an agent',
      href: '/admin/queue/job-assignment',
    },
    {
      id: 'qAgentSub',
      label: 'Agent submissions',
      count: submittedJobs?.length ?? 0,
      late: lateCount((submittedJobs ?? []).map((j) => j.submitted_at)),
      note: 'Photos and answers to review',
      href: '/admin/queue/agent-submissions',
    },
    {
      id: 'qAgentVerify',
      label: 'Agent verification',
      count: pendingAgents?.length ?? 0,
      late: lateCount((pendingAgents ?? []).map((a) => a.created_at)),
      note: 'New agents and documents',
      href: '/admin/queue/agent-verification',
    },
    {
      id: 'qService',
      label: 'Service requests',
      count: openRequests?.length ?? 0,
      late: lateCount((openRequests ?? []).map((r) => r.updated_at)),
      note: 'Customer questions',
      href: '/admin/queue/service-requests',
    },
    {
      id: 'qPayments',
      label: 'Payments',
      count: pendingPayments?.length ?? 0,
      late: lateCount((pendingPayments ?? []).map((p) => p.created_at)),
      note: 'Bank transfers to confirm',
      href: '/admin/queue/payments',
    },
  ];
}
