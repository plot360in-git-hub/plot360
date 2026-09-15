// Redesign 2026-09 (follow-up, round 4) — Plot flagged the header
// appearing on "Schedule a visit" too; the mock never has a persistent
// header on any of these screens, each has its own back-to-dashboard
// button instead (RegisterQuick.tsx, PropertyVisitHistory.tsx, and now
// ScheduleVisit.tsx). CustomerHeader no longer renders from this shared
// layout — moved to render individually from the handful of sub-pages
// under /properties that predate this redesign and have no navigation
// of their own yet (edit, plan, renew, subscribe, documents, ownership,
// visit-report/[jobId]) so they aren't left with nowhere to go. See
// those pages and ARCHITECTURE.md for the running list.
export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
