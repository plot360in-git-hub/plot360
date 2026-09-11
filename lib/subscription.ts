// 6-month plan → 1 visit, 12-month (or longer) plan → 2 visits, matching
// the twice-yearly monitoring cadence. Falls back to 1 visit for a
// payment with no plan attached (e.g. one an admin recorded manually
// without going through the customer subscribe flow).
export function maxVisitsForPlan(validityMonths: number | null | undefined) {
  return (validityMonths ?? 6) >= 12 ? 2 : 1;
}

// Base price with a discount % applied, rounded to the nearest rupee —
// this is what the customer actually pays, always derived from
// base_price + discount rather than stored as an independent number, so
// changing the discount later automatically reflects everywhere.
export function computePlanPrice(basePrice: number, discountPercent: number) {
  return Math.round(basePrice * (1 - discountPercent / 100));
}

// Renewal can carry its own discount, set separately from the first-
// purchase discount — null/undefined means "use the same discount as a
// first purchase" rather than defaulting to 0%.
export function effectiveDiscountPercent(
  plan: { discount_percent: number; renewal_discount_percent?: number | null },
  isRenewal: boolean
) {
  if (isRenewal && plan.renewal_discount_percent !== null && plan.renewal_discount_percent !== undefined) {
    return plan.renewal_discount_percent;
  }
  return plan.discount_percent;
}
