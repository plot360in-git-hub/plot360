import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { OwnershipForm } from '@/components/properties/registration/OwnershipForm';
import { getPropertyForEdit, getDocumentViewUrl } from '@/components/properties/registration/registration.actions';

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export default async function AdminOwnershipPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  const { ownership, documents } = await getPropertyForEdit(id);

  const nocDoc = documents.find((d) => d.doc_type === 'noc');
  const approvalDoc = documents.find((d) => d.doc_type === 'approval_letter');
  const ownerIdDoc = documents.find((d) => d.doc_type === 'owner_id');

  const [nocUrl, approvalUrl, ownerIdUrl] = await Promise.all([
    nocDoc ? getDocumentViewUrl(nocDoc.file_path) : null,
    approvalDoc ? getDocumentViewUrl(approvalDoc.file_path) : null,
    ownerIdDoc ? getDocumentViewUrl(ownerIdDoc.file_path) : null,
  ]);

  const hasExisting = {
    noc: nocDoc ? { name: filenameFromPath(nocDoc.file_path), url: nocUrl } : null,
    approval: approvalDoc ? { name: filenameFromPath(approvalDoc.file_path), url: approvalUrl } : null,
    ownerId: ownerIdDoc ? { name: filenameFromPath(ownerIdDoc.file_path), url: ownerIdUrl } : null,
  };

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <OwnershipForm
        propertyId={id}
        initialData={ownership ?? undefined}
        hasExisting={hasExisting}
        backHref={`/admin/${id}/edit`}
        redirectTo={`/admin/${id}/documents`}
      />
    </main>
  );
}
