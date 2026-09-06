import { DocumentsForm } from '@/components/properties/registration/DocumentsForm';
import { getPropertyForEdit, getDocumentViewUrl } from '@/components/properties/registration/registration.actions';

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { documents, ownership } = await getPropertyForEdit(id);

  const titleDeedDocs = documents.filter((d) => d.doc_type === 'title_deed');
  const ecRefDoc = documents.find((d) => d.doc_type === 'ec_reference_copy');

  const [titleDeedDocsWithUrls, ecRefUrl] = await Promise.all([
    Promise.all(
      titleDeedDocs.map(async (d) => ({ name: filenameFromPath(d.file_path), url: await getDocumentViewUrl(d.file_path) }))
    ),
    ecRefDoc ? getDocumentViewUrl(ecRefDoc.file_path) : null,
  ]);

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <DocumentsForm
        propertyId={id}
        existingTitleDeedDocs={titleDeedDocsWithUrls}
        existingEcReferenceCopy={ecRefDoc ? { name: filenameFromPath(ecRefDoc.file_path), url: ecRefUrl } : null}
        initialOwnership={ownership ?? undefined}
      />
    </main>
  );
}
