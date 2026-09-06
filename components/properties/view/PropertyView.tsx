import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getDocumentViewUrl } from '@/components/properties/registration/registration.actions';
import { getLatestPaymentForProperty } from '@/components/payments/payments.actions';
import type { DocumentType } from '@/types/database.types';

const DOC_LABELS: Record<DocumentType, string> = {
  title_deed: 'Property Title / Sale Deed',
  encumbrance_certificate: 'Encumbrance Certificate',
  noc: 'NOC Letter',
  approval_letter: 'Approval Letter',
  owner_id: 'Owner ID Proof',
  ownership_proof: 'Ownership Proof',
  ec_reference_copy: 'Old EC / Sale Deed Reference Copy',
};

async function getProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('properties').select('*').eq('id', propertyId).single();
  return data;
}

async function getDocuments(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('property_documents')
    .select('doc_type, file_path')
    .eq('property_id', propertyId);
  return data ?? [];
}

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export async function PropertyView({ propertyId }: { propertyId: string }) {
  const [property, documents, payment] = await Promise.all([
    getProperty(propertyId),
    getDocuments(propertyId),
    getLatestPaymentForProperty(propertyId),
  ]);
  if (!property) return <p>Property not found.</p>;

  const corners = property.gps_corners ?? {};
  const documentsWithUrls = await Promise.all(
    documents.map(async (d) => ({ ...d, url: await getDocumentViewUrl(d.file_path) }))
  );

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* Header: property name (big) + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1>{property.property_name}</h1>
          <span className={`status-pill ${property.status}`} style={{ marginTop: 8, display: 'inline-block' }}>
            {property.status === 'verified' ? 'Verified' : property.status === 'rejected' ? 'Rejected' : 'Not Verified'}
          </span>
        </div>
        <Link href="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>Close</Link>
      </div>

      {/* Property Information */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Property Information</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
          <div><dt className="field-label">Property Type</dt><dd>{property.property_type}</dd></div>
          <div><dt className="field-label">Plot / Land Size</dt><dd>{property.plot_size} {property.plot_size_unit}</dd></div>
          <div><dt className="field-label">Location / Address</dt><dd>{property.street_address}, {property.village_town}, {property.district}, {property.state}</dd></div>
          <div><dt className="field-label">Registration Date</dt><dd>{property.registration_date ?? '—'}</dd></div>
          <div><dt className="field-label">Expiration Date</dt><dd>{property.expiration_date ?? '—'}</dd></div>
          <div><dt className="field-label">Nearby Landmark</dt><dd>{property.near_by_landmark || '—'}</dd></div>
        </dl>
      </div>

      {/* Uploaded Documents */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Uploaded Documents</h3>
        {documentsWithUrls.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No documents uploaded yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {documentsWithUrls.map((d) => (
              <li key={d.doc_type} style={{ marginBottom: 10 }}>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
                    {DOC_LABELS[d.doc_type as DocumentType] ?? d.doc_type}
                  </a>
                ) : (
                  <span>{DOC_LABELS[d.doc_type as DocumentType] ?? d.doc_type}</span>
                )}
                <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}> — {filenameFromPath(d.file_path)}</span>
              </li>
            ))}
          </ul>
        )}
        {property.status !== 'verified' && (
          <Link href={`/properties/${propertyId}/documents`} style={{ color: 'var(--color-accent)', fontSize: 14 }}>
            Add or update documents
          </Link>
        )}
      </div>

      {/* Payment status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Payment</h3>
        {!payment ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No payment required yet — this stage comes after admin verification.</p>
        ) : payment.status === 'completed' ? (
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
            <div><dt className="field-label">Status</dt><dd><span className="status-pill verified">Completed</span></dd></div>
            <div><dt className="field-label">Paid on</dt><dd>{payment.paid_at}</dd></div>
            <div><dt className="field-label">Valid from</dt><dd>{payment.valid_from}</dd></div>
            <div><dt className="field-label">Next payment due</dt><dd>{payment.valid_until}</dd></div>
          </dl>
        ) : (
          <div>
            <span className="status-pill pending" style={{ marginBottom: 12, display: 'inline-block' }}>Pending</span>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              {payment.payment_type === 'renewal' ? 'Your renewal' : 'Your registration'} has been approved and is
              awaiting payment confirmation. Please complete payment and contact support with your reference —
              an admin will confirm it here once received.
            </p>
          </div>
        )}
      </div>

      {/* Location Map: GPS coordinates block */}
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Location Map</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24, marginBottom: 16 }}>
          <div><dt className="field-label">NE Latitude / Longitude</dt><dd>{corners.ne?.lat ?? '—'}, {corners.ne?.lng ?? '—'}</dd></div>
          <div><dt className="field-label">SE Latitude / Longitude</dt><dd>{corners.se?.lat ?? '—'}, {corners.se?.lng ?? '—'}</dd></div>
          <div><dt className="field-label">NW Latitude / Longitude</dt><dd>{corners.nw?.lat ?? '—'}, {corners.nw?.lng ?? '—'}</dd></div>
          <div><dt className="field-label">SW Latitude / Longitude</dt><dd>{corners.sw?.lat ?? '—'}, {corners.sw?.lng ?? '—'}</dd></div>
        </dl>
        {property.google_map_lat && property.google_map_lng ? (
          <iframe
            title="Property location"
            width="100%"
            height="300"
            style={{ border: 0, borderRadius: 'var(--radius-input)' }}
            loading="lazy"
            src={`https://www.google.com/maps?q=${property.google_map_lat},${property.google_map_lng}&output=embed`}
          />
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>No map pin set yet.</p>
        )}
      </div>
    </div>
  );
}
