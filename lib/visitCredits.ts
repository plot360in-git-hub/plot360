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
export function canScheduleVisit(
  propertyStatus: 'pending' | 'verified' | 'rejected',
  credits: VisitCredit[],
  today: Date = new Date()
): { eligible: boolean; hasCredits: boolean; reason?: string } {
  if (propertyStatus !== 'verified') {
    return { eligible: false, hasCredits: false, reason: 'Not verified yet — a representative is still collecting documents' };
  }
  const hasCredits = totalRemainingCredits(credits, today) > 0;
  return { eligible: true, hasCredits };
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
