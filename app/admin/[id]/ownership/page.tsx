import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { OwnershipForm } from '@/components/properties/registration/OwnershipForm';
import {
  getPropertyForEdit,
  getDocumentViewUrl,
  getReusableOwnerIdProof,
} from '@/components/properties/registration/registration.actions';

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// Redesign 2026-09 (follow-up, round 13) — no longer wrapped in the old
// container-narrow class: OwnershipForm now renders its own full `.p360`
// page frame (back-button header, etc.), the same pattern used by every
// other redesigned standalone screen — see ARCHITECTURE.md.
export default async function AdminOwnershipPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { id } = await params;
  const { ownership, documents } = await getPropertyForEdit(id);

  const nocDoc = documents.find((d) => d.doc_type === 'noc');
  const ownerIdDoc = documents.find((d) => d.doc_type === 'owner_id');
  const titleDeedDocs = documents.filter((d) => d.doc_type === 'title_deed');

  const [nocUrl, ownerIdUrl, titleDeedDocsWithUrls, reusableOwnerIdProof] = await Promise.all([
    nocDoc ? getDocumentViewUrl(nocDoc.file_path) : null,
    ownerIdDoc ? getDocumentViewUrl(ownerIdDoc.file_path) : null,
    Promise.all(titleDeedDocs.map(async (d) => ({ name: filenameFromPath(d.file_path), url: await getDocumentViewUrl(d.file_path) }))),
    getReusableOwnerIdProof(id),
  ]);

  const hasExisting = {
    noc: nocDoc ? { name: filenameFromPath(nocDoc.file_path), url: nocUrl } : null,
    ownerId: ownerIdDoc ? { name: filenameFromPath(ownerIdDoc.file_path), url: ownerIdUrl } : null,
  };

  return (
    <OwnershipForm
      propertyId={id}
      initialData={ownership ?? undefined}
      hasExisting={hasExisting}
      existingTitleDeedDocs={titleDeedDocsWithUrls}
      reusableOwnerIdProof={reusableOwnerIdProof}
      backHref={`/admin/${id}/edit`}
      redirectTo={`/admin/${id}/documents`}
    />
  );
}
