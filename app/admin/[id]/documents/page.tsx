import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { DocumentsForm } from '@/components/properties/registration/DocumentsForm';
import { getPropertyForEdit, getDocumentViewUrl } from '@/components/properties/registration/registration.actions';

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export default async function AdminDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  const { documents, ownership } = await getPropertyForEdit(id);

  const ecRefDoc = documents.find((d) => d.doc_type === 'ec_reference_copy');
  const ecRefUrl = ecRefDoc ? await getDocumentViewUrl(ecRefDoc.file_path) : null;

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <DocumentsForm
        propertyId={id}
        existingEcReferenceCopy={ecRefDoc ? { name: filenameFromPath(ecRefDoc.file_path), url: ecRefUrl } : null}
        initialOwnership={ownership ?? undefined}
        backHref={`/admin/${id}/ownership`}
        cancelHref={`/admin/${id}`}
        redirectTo={`/admin/${id}`}
      />
    </main>
  );
}
