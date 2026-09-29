// Redesign 2026-09 (follow-up, 2026-09-28) — plot-size-tiered pricing.
// See supabase/schema.sql, plot_size_price_tiers, for the shape and the
// product reasoning (one shared size table for every visit plan, not a
// price matrix; "contact us" rather than extrapolating past the last
// admin-defined band). Pure helpers so both the customer payment screen
// (client-side, live recalculation as the customer edits plot size) and
// purchaseVisitCredits (server-side, the number that's actually charged)
// use the exact same logic — the server never trusts a client-computed
// price, only a client-entered plot size.

export type PlotSizeTier = {
  id: string;
  min_size: number;
  max_size: number | null;
  extra_price: number;
  display_order: number;
};

// The band a given plot size falls into, or null if it's bigger than
// every defined band's max_size (an open-ended band, max_size null,
// always matches once size >= its min_size).
export function findPlotSizeTier(tiers: PlotSizeTier[], plotSize: number): PlotSizeTier | null {
  const sorted = [...tiers].sort((a, b) => a.min_size - b.min_size);
  return sorted.find((t) => plotSize >= t.min_size && (t.max_size == null || plotSize <= t.max_size)) ?? null;
}

export type PlotSizeSurcharge = {
  tier: PlotSizeTier | null;
  surcharge: number;
  // true when plotSize is bigger than every defined band — no price could
  // be determined, the caller should show "contact us for a quote"
  // instead of a number.
  overMax: boolean;
};

export function computePlotSizeSurcharge(tiers: PlotSizeTier[], plotSize: number): PlotSizeSurcharge {
  if (!plotSize || plotSize <= 0) return { tier: null, surcharge: 0, overMax: false };
  const tier = findPlotSizeTier(tiers, plotSize);
  if (!tier) return { tier: null, surcharge: 0, overMax: true };
  return { tier, surcharge: tier.extra_price, overMax: false };
}

// Short label for a band, e.g. "Up to 500 sq yd", "500–1000 sq yd", or
// "2000 sq yd and above" — used on both the admin Plans page's tier list
// and (implicitly, via the matched tier) nowhere customer-facing today,
// but kept here so both ever stay in sync if that changes.
export function plotSizeTierLabel(tier: Pick<PlotSizeTier, 'min_size' | 'max_size'>): string {
  if (tier.min_size <= 0 && tier.max_size != null) return `Up to ${tier.max_size} sq yd`;
  if (tier.max_size == null) return `${tier.min_size} sq yd and above`;
  return `${tier.min_size}–${tier.max_size} sq yd`;
}
