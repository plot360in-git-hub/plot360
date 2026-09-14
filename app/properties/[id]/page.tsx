import { PropertyVisitHistory } from '@/components/customer/PropertyVisitHistory';
import { TaskList } from '@/components/tasks/TaskList';

// Redesign 2026-09 — swapped to the new "Property visit history" screen
// (design_handoff_plot360_redesign, "Plot360 Customer.dc.html"), replacing
// the old PropertyView + MonitoringStatus pairing. Both of those files are
// kept intact (unused-but-not-deleted) — see PropertyVisitHistory.tsx for
// why they're not rendered from this route anymore. TaskList is untouched
// by the redesign and keeps working exactly as before.
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <PropertyVisitHistory propertyId={id} />
      {/* Deliberately OUTSIDE the .p360 wrapper — TaskList uses the old
          global .card/.field-label classes, which read CSS custom
          properties (--color-accent etc.) that .p360 re-declares with
          different (red vs grey) values. Nesting it inside .p360 would
          leak the new palette into this untouched component. */}
      <div className="container-wide" style={{ paddingBottom: 60 }}>
        <TaskList propertyId={id} />
      </div>
    </main>
  );
}
