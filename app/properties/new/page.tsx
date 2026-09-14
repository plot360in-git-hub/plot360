import { RegisterQuick } from '@/components/customer/RegisterQuick';

// Redesign 2026-09 — swapped to the simplified quick-registration flow
// (design_handoff_plot360_redesign, "Plot360 Customer.dc.html"). The old
// full-detail PlotDetailsForm + createProperty are kept intact and still
// power /properties/[id]/edit for existing properties — see
// registration.actions.ts, createPropertyQuick, and ARCHITECTURE.md.
export default function NewPropertyPage() {
  return (
    <main className="p360" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 0' }}>
        <div className="card section-alt" style={{ borderColor: 'var(--color-accent)' }}>
          <p style={{ fontSize: 13 }}>
            <strong>Coverage notice:</strong> Plot360 currently provides services in GHMC and the
            surrounding ORR (Outer Ring Road) area only. We&rsquo;re gradually expanding to other
            districts and states.
          </p>
        </div>
      </div>
      <RegisterQuick />
    </main>
  );
}
