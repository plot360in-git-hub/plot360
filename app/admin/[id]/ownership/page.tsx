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
//
// Redesign 2026-09 (follow-up, round 14) — Save now finalizes the
// property directly (the separate Documents step is gone), so this
// redirects back to the property's own admin detail page instead of a
// now-deleted /admin/[id]/documents route.
//
// Redesign 2026-09 (follow-up, round 15) — backHref was wrongly pointing
// at the old, obsolete /admin/[id]/edit ("Edit Property Details") page —
// Plot caught this: clicking the back arrow on Edit ownership landed on
// that pre-redesign page instead of returning to Property verification.
// Fixed to go back to the property's own verification detail page
// (/admin/[id], PropertyVerificationDetail) instead. Nothing in the live
// admin UI links to /admin/[id]/edit any more as a result — Plot flagged
// that page's styling as broken too, and since it's now unreachable from
// this flow, it wasn't restyled (matches how other confirmed-dead legacy
// pages in this app, e.g. AdminHeader.tsx/AdminReview.tsx, are handled).
// If property_type/plot_shape/description/GPS-corner fields (the ones
// LocationFieldsForm on the verification page doesn't cover) still need
// an admin-editable home, that page exists at /admin/[id]/edit by direct
// URL, or a live link back to it can be added — flagging this rather
// than guessing.
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
      backHref={`/admin/${id}`}
      redirectTo={`/admin/${id}`}
    />
  );
}
