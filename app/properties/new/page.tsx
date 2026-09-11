import { PlotDetailsForm } from '@/components/properties/registration/PlotDetailsForm';

export default function NewPropertyPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div
        className="card section-alt"
        style={{ maxWidth: 640, margin: '0 auto 24px', borderColor: 'var(--color-accent)' }}
      >
        <p style={{ fontSize: 14 }}>
          <strong>Coverage notice:</strong> Plot360 currently provides services in GHMC and the
          surrounding ORR (Outer Ring Road) area only. We're gradually expanding to other
          districts and states — check back soon if your property falls outside this zone.
        </p>
      </div>
      <PlotDetailsForm />
    </main>
  );
}
