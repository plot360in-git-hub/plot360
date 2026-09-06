import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getPropertyForEdit } from '@/components/properties/registration/registration.actions';
import { PlotDetailsForm } from '@/components/properties/registration/PlotDetailsForm';

export default async function AdminEditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  const { property } = await getPropertyForEdit(id);
  if (!property) return <p className="container-narrow">Property not found.</p>;

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <PlotDetailsForm mode="edit" propertyId={id} initialData={property} redirectTo={`/admin/${id}/ownership`} />
    </main>
  );
}
