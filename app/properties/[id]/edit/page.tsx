import Link from 'next/link';
import { PlotDetailsForm } from '@/components/properties/registration/PlotDetailsForm';
import { canEditProperty, getPropertyForEdit } from '@/components/properties/registration/registration.actions';
import { CustomerHeader } from '@/components/layout/CustomerHeader';

// Redesign 2026-09 (follow-up, round 4) — CustomerHeader used to come
// from app/properties/layout.tsx for every /properties/* route; that
// layout no longer renders it (the mock has no persistent header on any
// redesigned screen). This full-detail edit form predates the redesign
// and has no back button of its own, so it renders CustomerHeader
// directly instead of being left with no navigation at all.
export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const allowed = await canEditProperty(id);
  const { property } = await getPropertyForEdit(id);

  if (!property) return <p className="container-narrow">Property not found.</p>;

  if (!allowed) {
    return (
      <>
        <CustomerHeader />
        <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
          <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 12 }}>This property is verified</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Verified properties can only be updated by an admin. If something needs to change,
              contact support and request an edit — an admin can make the change on your behalf.
            </p>
            <Link href={`/properties/${id}`} className="btn-primary" style={{ textDecoration: 'none' }}>
              Back to property
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <CustomerHeader />
      <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <PlotDetailsForm mode="edit" propertyId={id} initialData={property} />
      </main>
    </>
  );
}
