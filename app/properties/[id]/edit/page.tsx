import Link from 'next/link';
import { PlotDetailsForm } from '@/components/properties/registration/PlotDetailsForm';
import { canEditProperty, getPropertyForEdit } from '@/components/properties/registration/registration.actions';

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const allowed = await canEditProperty(id);
  const { property } = await getPropertyForEdit(id);

  if (!property) return <p className="container-narrow">Property not found.</p>;

  if (!allowed) {
    return (
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
    );
  }

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <PlotDetailsForm mode="edit" propertyId={id} initialData={property} />
    </main>
  );
}
