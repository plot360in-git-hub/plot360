// Redesign 2026-09 (follow-up, round 22) — same fix as
// app/dashboard/layout.tsx (customer, round 2): every screen this layout
// wraps (AgentJobsHome, AgentUnderReview, AgentCaptureScreen) now owns its
// own full-width .p360 header/back-button, so the old shared AgentHeader
// was showing a duplicate top nav bar above the new design. Removed here,
// and from the sibling agent layouts (jobs, profile, onboarding) below.
export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
