// Redesign 2026-09 (follow-up, round 2) — Plot flagged that /dashboard was
// still showing a persistent top nav bar even after CustomerHeader.tsx
// reskinned it (previous commit): the design mock has NO header at all on
// this screen — the red poster block (PLOT360 wordmark + identity, inside
// the poster itself) is the very first thing on the page. Removed
// CustomerHeader here to match. Log out (the one bit of real functionality
// the header carried that has no other home) now lives as a small link
// next to the identity text inside CustomerHome's poster — see that file.
//
// Scoped to /dashboard only, not the other 5 layouts that still import
// CustomerHeader: /properties covers several not-yet-redesigned sub-pages
// (edit, plan, schedule, renew, subscribe, documents, ownership,
// visit-report) that have no back button of their own yet and would be
// left with zero navigation if the header vanished from under them too;
// /onboarding, /profile and /tasks are similarly still pre-redesign pages.
// /service-requests' two routes already have their own back-to-dashboard
// button (ServiceRequestScreen.tsx) but were left alone here to keep this
// change narrowly scoped to the page Plot actually reported.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
