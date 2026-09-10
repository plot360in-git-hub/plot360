// 6-month plan → 1 visit, 12-month (or longer) plan → 2 visits, matching
// the twice-yearly monitoring cadence. Falls back to 1 visit for a
// payment with no plan attached (e.g. one an admin recorded manually
// without going through the customer subscribe flow).
export function maxVisitsForPlan(validityMonths: number | null | undefined) {
  return (validityMonths ?? 6) >= 12 ? 2 : 1;
}
