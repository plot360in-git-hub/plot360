// Redesign 2026-09 — agent app capture screen (design_handoff_plot360_redesign,
// "Plot360 Agent.dc.html"): "warn, never block" GPS check. The agent's
// current position is compared to the property's recorded pin; a large
// distance is shown and recorded on submit, but never prevents submitting.

// Great-circle distance between two lat/lng points, in meters.
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Distance beyond which the reviewer sees a flag — a placeholder figure
// (the design mock shows 310m flagged as an example, with no stated
// threshold); tune once real GPS accuracy data comes in.
export const GPS_FLAG_THRESHOLD_METERS = 150;
