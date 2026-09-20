'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOwnerAdmin } from './admin-role.actions';
import { profileDisplayName } from './displayName';

// Redesign 2026-09 (round 32) — Accounting (owner role only, same gate
// as Plans & pricing and Users — see app/admin/accounting/page.tsx).
// Plot: UPI payments self-confirm while bank transfers wait on an
// admin — if a UPI payment is ever wrong there was nowhere to see
// every payment (either method, any status) side by side to tally
// against properties, and nothing at all tracking what's owed/paid to
// agents for their completed visits. This is deliberately bookkeeping
// only, per Plot's own scoping call: the admin still pays the agent
// outside the app and just records it here.
async function requireAdmin() {
  const gate = await requireOwnerAdmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const supabase = await createClient();
  return { ok: true as const, supabase, userId: gate.userId };
}

// ---------- Payments received ----------

// Every payment (any status, either method) so the owner can tally
// what's actually come in against properties — unlike getPendingPayments/
// getCompletedPayments (payments.actions.ts), which are each scoped to
// one status for their own single-purpose screens (the Payments queue,
// the old PaymentsOverview history table).
export async function getPaymentsLedger() {
  const gate = await requireAdmin();
  if (!gate.ok) return { rows: [], totals: { completed: 0, pending: 0 } };

  const { data } = await gate.supabase
    .from('payments')
    .select(
      '*, subscription_plans(name, price, visit_quantity), properties(id, property_name, owner_id, profiles(username, first_name, last_name, email))'
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []).map((p: any) => ({
    id: p.id,
    createdAt: p.created_at,
    paidAt: p.paid_at,
    propertyId: p.properties?.id ?? null,
    propertyName: p.properties?.property_name ?? 'Property',
    customerName: profileDisplayName(p.properties?.profiles),
    customerEmail: p.properties?.profiles?.email ?? null,
    paymentType: p.payment_type,
    status: p.status,
    method: p.payment_method,
    amount: p.amount != null ? Number(p.amount) : null,
    reference: p.transaction_reference,
    mismatchReason: p.mismatch_reason,
    planName: p.subscription_plans?.name ?? null,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === 'completed') acc.completed += r.amount ?? 0;
      else if (r.status === 'pending') acc.pending += r.amount ?? 0;
      return acc;
    },
    { completed: 0, pending: 0 }
  );

  return { rows, totals };
}

// ---------- Agent payouts ----------

// One row per agent with a completed (approved) visit, whether or not
// they've been paid for all of them yet — an agent with zero approved
// visits never shows up, there's nothing to pay them for.
export async function getAgentPayoutSummary() {
  const gate = await requireAdmin();
  if (!gate.ok) return { agents: [], rate: null as number | null };

  const [{ data: settings }, { data: jobs }, { data: payouts }] = await Promise.all([
    gate.supabase.from('payment_settings').select('agent_visit_payout_rate').limit(1).maybeSingle(),
    gate.supabase
      .from('monitoring_jobs')
      .select('id, agent_id, visit_number, decided_at, properties(property_name), agent_profiles(profiles(first_name, last_name, email))')
      .eq('status', 'approved')
      .order('decided_at', { ascending: true }),
    gate.supabase.from('agent_payouts').select('job_id, amount, paid_at'),
  ]);

  const rate = settings?.agent_visit_payout_rate != null ? Number(settings.agent_visit_payout_rate) : null;
  const paidJobIds = new Set((payouts ?? []).map((p: any) => p.job_id));
  const paidTotalByJob = new Map((payouts ?? []).map((p: any) => [p.job_id, Number(p.amount)]));

  const byAgent = new Map<
    string,
    {
      agentId: string;
      name: string;
      email: string | null;
      approvedVisits: number;
      unpaidJobs: { jobId: string; propertyName: string; visitNumber: number | null; decidedAt: string | null }[];
      paidTotal: number;
    }
  >();

  for (const j of (jobs as any[]) ?? []) {
    const agentId = j.agent_id;
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        agentId,
        name: profileDisplayName(j.agent_profiles?.profiles),
        email: j.agent_profiles?.profiles?.email ?? null,
        approvedVisits: 0,
        unpaidJobs: [],
        paidTotal: 0,
      });
    }
    const entry = byAgent.get(agentId)!;
    entry.approvedVisits += 1;
    if (paidJobIds.has(j.id)) {
      entry.paidTotal += paidTotalByJob.get(j.id) ?? 0;
    } else {
      entry.unpaidJobs.push({
        jobId: j.id,
        propertyName: j.properties?.property_name ?? 'Property',
        visitNumber: j.visit_number,
        decidedAt: j.decided_at,
      });
    }
  }

  const agents = Array.from(byAgent.values())
    .map((a) => ({ ...a, unpaidCount: a.unpaidJobs.length, owed: rate != null ? a.unpaidJobs.length * rate : null }))
    .sort((a, b) => b.unpaidCount - a.unpaidCount || a.name.localeCompare(b.name));

  return { agents, rate };
}

// Records one agent's payout for a single completed visit. job_id is
// unique on agent_payouts, so this can never double-pay the same visit
// — recordAgentPayout simply fails (unique violation) if it's tried.
export async function recordAgentPayout(agentId: string, jobId: string, formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const amountRaw = String(formData.get('amount') || '').trim();
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: 'Enter a valid payout amount.' };

  const paymentMethod = String(formData.get('payment_method') || '').trim() || null;
  const reference = String(formData.get('reference') || '').trim() || null;
  const notes = String(formData.get('notes') || '').trim() || null;
  const paidAt = String(formData.get('paid_at') || '') || new Date().toISOString().slice(0, 10);

  const { error } = await gate.supabase.from('agent_payouts').insert({
    agent_id: agentId,
    job_id: jobId,
    amount,
    payment_method: paymentMethod,
    reference,
    notes,
    paid_at: paidAt,
    recorded_by: gate.userId,
  });
  if (error) {
    if (error.code === '23505') return { error: 'That visit has already been marked paid.' };
    return { error: error.message };
  }

  revalidatePath('/admin/accounting');
  return { success: true };
}

// Bulk version of the above for "Pay all unpaid" — one agent_payouts
// row per job (so each stays individually unique/auditable), all
// sharing the same method/reference/notes/paid_at from one form
// submit. Skips any job that's somehow already paid rather than
// failing the whole batch.
export async function recordAgentPayoutBulk(agentId: string, jobIds: string[], amountPerVisit: number, formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  if (jobIds.length === 0) return { error: 'Nothing to pay.' };
  if (!amountPerVisit || amountPerVisit <= 0) return { error: 'Enter a valid per-visit payout amount.' };

  const paymentMethod = String(formData.get('payment_method') || '').trim() || null;
  const reference = String(formData.get('reference') || '').trim() || null;
  const notes = String(formData.get('notes') || '').trim() || null;
  const paidAt = String(formData.get('paid_at') || '') || new Date().toISOString().slice(0, 10);

  const { data: alreadyPaid } = await gate.supabase.from('agent_payouts').select('job_id').in('job_id', jobIds);
  const alreadyPaidIds = new Set((alreadyPaid ?? []).map((p: any) => p.job_id));
  const toInsert = jobIds
    .filter((id) => !alreadyPaidIds.has(id))
    .map((jobId) => ({
      agent_id: agentId,
      job_id: jobId,
      amount: amountPerVisit,
      payment_method: paymentMethod,
      reference,
      notes,
      paid_at: paidAt,
      recorded_by: gate.userId,
    }));

  if (toInsert.length === 0) return { error: 'Those visits have already been marked paid.' };

  const { error } = await gate.supabase.from('agent_payouts').insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath('/admin/accounting');
  return { success: true, paidCount: toInsert.length };
}
