import { PropertyVisitHistory } from '@/components/customer/PropertyVisitHistory';

// Redesign 2026-09 — swapped to the new "Property visit history" screen
// (design_handoff_plot360_redesign, "Plot360 Customer.dc.html"), replacing
// the old PropertyView + MonitoringStatus pairing. Both of those files are
// kept intact (unused-but-not-deleted) — see PropertyVisitHistory.tsx for
// why they're not rendered from this route anymore.
//
// Redesign 2026-09 (follow-up) — TaskList used to render below this,
// "since it's an unrelated feature this redesign doesn't touch." Plot
// flagged it directly: the design's property visit-history screen has no
// task list at all, and having the old-style table sitting under the new
// screen read as leftover old design. Removed from this page only —
// TaskList.tsx and the /tasks route it also powers are both untouched.
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <PropertyVisitHistory propertyId={id} />
    </main>
  );
}
