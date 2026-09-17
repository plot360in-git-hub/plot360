import type { VisitCredit } from '@/types/database.types';

// Pure helpers over the visit_credits ledger (supabase/schema.sql,
// "Redesign 2026-09 — foundation"). A property can have several
// visit_credits rows over time (e.g. bought 1, used it, bought 4 more) —
// every function here works across the whole set for a property, never a
// single row, so callers don't have to re-derive "current" credits.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Credits still usable right now: not expired, and not fully used.
export function activeCredits(credits: VisitCredit[], today: Date = new Date()): VisitCredit[] {
  return credits.filter((c) => new Date(c.expires_at) >= today && c.quantity_used < c.quantity_purchased);
}

// Total visits left across every still-active credit row for a property —
// the number the customer app's "Site visits in credit" poster shows.
export function totalRemainingCredits(credits: VisitCredit[], today: Date = new Date()): number {
  return activeCredits(credits, today).reduce((sum, c) => sum + (c.quantity_purchased - c.quantity_used), 0);
}

// The soonest expiry among active credits — drives the property card's
// "expires in N days" warning and the 60-day WhatsApp reminder job.
export function nearestExpiry(credits: VisitCredit[], today: Date = new Date()): Date | null {
  const active = activeCredits(credits, today);
  if (active.length === 0) return null;
  return active.reduce(
    (earliest, c) => {
      const d = new Date(c.expires_at);
      return !earliest || d < earliest ? d : earliest;
    },
    null as Date | null
  );
}

export function daysUntil(date: Date, today: Date = new Date()): number {
  return Math.ceil((date.getTime() - today.getTime()) / MS_PER_DAY);
}

// README: "warn on the property card under 60 days".
export function isExpiringSoon(credits: VisitCredit[], thresholdDays = 60, today: Date = new Date()): boolean {
  const expiry = nearestExpiry(credits, today);
  if (!expiry) return false;
  return daysUntil(expiry, today) <= thresholdDays;
}

// Which single credit row a new visit should draw down — oldest expiry
// first, so a customer's older purchase is used before a newer one lapses.
export function creditToConsume(credits: VisitCredit[], today: Date = new Date()): VisitCredit | null {
  const active = activeCredits(credits, today);
  if (active.length === 0) return null;
  return [...active].sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0];
}

// Scheduling eligibility for the "Schedule a visit" property picker:
// - eligible with credits -> selectable
// - 0 credits -> selectable, but the CTA routes to payment (see README,
//   "Schedule a visit" screen) — that branching stays in the UI, this
//   function only reports the boolean the UI branches on
// - unverified -> disabled entirely
// - first visit not started yet -> disabled entirely (see hasFirstVisit below)
//
// Redesign 2026-09 (follow-up, round 19) — Plot's report: once a property
// is verified and paid, the FIRST visit should go straight to Job
// assignment (components/admin/monitoring.actions.ts,
// getEligiblePropertiesForAssignment — already built to surface it
// immediately, no due-date wait), with no action needed from the
// customer. Only a SECOND or later visit on the same property should
// ever be something the customer explicitly schedules here. Before this,
// canScheduleVisit had no way to tell the two apart — a customer with
// spare credits could open this screen and self-schedule what was
// supposed to be their automatic first visit, right alongside (or ahead
// of) the one already sitting in the admin's Job assignment queue.
// hasFirstVisit — true once at least one monitoring_jobs row already
// exists for the property, i.e. the first visit has been created
// (assigned, in progress, or done) by the admin — is now required to
// unlock this screen at all.
export function canScheduleVisit(
  propertyStatus: 'pending' | 'verified' | 'rejected',
  credits: VisitCredit[],
  hasFirstVisit: boolean,
  today: Date = new Date()
): { eligible: boolean; hasCredits: boolean; reason?: string } {
  if (propertyStatus !== 'verified') {
    return { eligible: false, hasCredits: false, reason: 'Not verified yet — a representative is still collecting documents' };
  }
  if (!hasFirstVisit) {
    return {
      eligible: false,
      hasCredits: false,
      reason: 'Your first visit is arranged automatically — our team is assigning an agent, no action needed from you. You can schedule additional visits here once it’s done.',
    };
  }
  const hasCredits = totalRemainingCredits(credits, today) > 0;
  return { eligible: true, hasCredits };
}

// Credits left once open/assigned visit_requests are accounted for — the
// customer app's "Schedule a visit" screen shouldn't let someone request
// more visits than they actually have room for while earlier requests are
// still awaiting an agent (quantity_used on the ledger itself only moves
// once a visit is approved, so it can't reflect this on its own).
export function remainingAfterReservations(
  credits: VisitCredit[],
  reservedCount: number,
  today: Date = new Date()
): number {
  return Math.max(totalRemainingCredits(credits, today) - reservedCount, 0);
}

// expires_at for a new purchase: purchased_at + 1 year, plus any granted
// extension in days. Lapsed credits can be extended once by an admin
// (30/60/90 days, with a reason) — pass the running total of days already
// granted as extensionDays when re-computing after a new extension.
export function computeExpiryDate(purchasedAt: Date, extensionDays = 0): Date {
  const d = new Date(purchasedAt);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() + extensionDays);
  return d;
}

// Redesign 2026-09 (follow-up) — moved here from CustomerHome.tsx so
// PropertyVisitHistory.tsx (a server component) can share it too, instead
// of importing from a 'use client' file or duplicating the logic — the
// mock's REGISTERED/VERIFIED/VISIT SET/REPORT track appears on both the
// Home screen's property cards and the property detail screen.
export const MILESTONES = ['Registered', 'Verified', 'Visit set', 'Report'];

type MilestoneProperty = { status: 'pending' | 'verified' | 'rejected' };
type MilestoneJob = { status: string };

// Milestone track: Registered (row exists) -> Verified (admin approved) ->
// Visit set (a visit has been requested/assigned) -> Report (at least one
// visit approved, so a report exists). Returns how many of the 4 are done.
export function milestoneStage(property: MilestoneProperty, jobs: MilestoneJob[], hasOpenRequest: boolean): number {
  if (property.status === 'rejected') return 1;
  let stage = 1; // registered
  if (property.status === 'verified') stage = 2;
  const hasActiveVisit = hasOpenRequest || jobs.some((j) => ['assigned', 'accepted', 'submitted'].includes(j.status));
  const hasReport = jobs.some((j) => ['approved', 'ec_pending'].includes(j.status));
  if (stage === 2 && (hasActiveVisit || hasReport)) stage = 3;
  if (stage === 3 && hasReport) stage = 4;
  return stage;
}
