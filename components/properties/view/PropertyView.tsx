import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getDocumentViewUrl } from '@/components/properties/registration/registration.actions';
import { getLatestPaymentForProperty } from '@/components/payments/payments.actions';
import { DeletePropertyButton } from '../DeletePropertyButton';
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

  const address = [property.street_address, property.village_town, property.district, property.state]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="container-wide" style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* Header: property name (big) + status + actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span className={`status-pill ${property.status}`}>
            {property.status === 'verified' ? 'Verified' : property.status === 'rejected' ? 'Rejected' : 'Not Verified'}
          </span>
          <h1 style={{ fontSize: 30, marginTop: 12, marginBottom: 6 }}>{property.property_name}</h1>
          {address && <p style={{ color: 'var(--color-text-muted)', fontSize: 15.5, margin: 0 }}>{address}</p>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/dashboard" className="btn-primary" style={{ textDecoration: 'none' }}>Close</Link>
          <DeletePropertyButton propertyId={property.id} propertyName={property.property_name} />
        </div>
      </div>

      {/* Quick stats */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
          padding: '20px 0',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 32,
        }}
      >
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Property type</p>
          <p style={{ fontSize: 15.5, fontWeight: 500, margin: 0 }}>{property.property_type}</p>
        </div>
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Plot / land size</p>
          <p style={{ fontSize: 15.5, fontWeight: 500, margin: 0 }}>{property.plot_size} {property.plot_size_unit}</p>
        </div>
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Registered on</p>
          <p style={{ fontSize: 15.5, fontWeight: 500, margin: 0 }}>{property.registration_date ?? '—'}</p>
        </div>
        <div>
          <p className="field-label" style={{ marginBottom: 4 }}>Expires</p>
          <p style={{ fontSize: 15.5, fontWeight: 500, margin: 0 }}>{property.expiration_date ?? '—'}</p>
        </div>
      </div>

      {/* Property Information */}
      {property.status === 'rejected' && property.rejection_reason && (
        <div className="card section-alt" style={{ marginBottom: 24, borderColor: 'var(--color-danger)' }}>
          <p className="field-label" style={{ marginBottom: 6 }}>Why this was rejected</p>
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{property.rejection_reason}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Property Information</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
          <div><dt className="field-label">Property Type</dt><dd>{property.property_type}</dd></div>
          <div><dt className="field-label">Plot / Land Size</dt><dd>{property.plot_size} {property.plot_size_unit}</dd></div>
          <div><dt className="field-label">Location / Address</dt><dd>{address || '—'}</dd></div>
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
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {documentsWithUrls.map((d) => (
              <li
                key={d.file_path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 0',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
                    {DOC_LABELS[d.doc_type as DocumentType] ?? d.doc_type}
                  </a>
                ) : (
                  <span>{DOC_LABELS[d.doc_type as DocumentType] ?? d.doc_type}</span>
                )}
                <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>— {filenameFromPath(d.file_path)}</span>
              </li>
            ))}
          </ul>
        )}
        {property.status !== 'verified' && (
          <Link href={`/properties/${propertyId}/documents`} style={{ color: 'var(--color-link)', fontSize: 14, display: 'inline-block', marginTop: 12 }}>
            Add or update documents
          </Link>
        )}
      </div>

      {/* Payment status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Payment</h3>
        {!payment ? (
          property.status === 'verified' ? (
            <div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 12 }}>
                Your property is verified — subscribe to activate monitoring and set your validity period.
              </p>
              <Link href={`/properties/${propertyId}/subscribe`} className="btn-primary" style={{ textDecoration: 'none' }}>
                Subscribe now
              </Link>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>No payment required yet — this stage comes after admin verification.</p>
          )
        ) : payment.status === 'completed' ? (
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
            <div><dt className="field-label">Status</dt><dd><span className="status-pill verified">Completed</span></dd></div>
            <div><dt className="field-label">Paid on</dt><dd>{payment.paid_at}</dd></div>
            <div><dt className="field-label">Valid from</dt><dd>{payment.valid_from}</dd></div>
            <div><dt className="field-label">Next payment due</dt><dd>{payment.valid_until}</dd></div>
          </dl>
        ) : payment.transaction_reference ? (
          <div>
            <span className="status-pill pending" style={{ marginBottom: 12, display: 'inline-block' }}>Awaiting confirmation</span>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              You've submitted payment proof — an admin will verify and confirm it shortly.
            </p>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 12 }}>
              Your property is verified — subscribe to activate monitoring and set your validity period.
            </p>
            <Link href={`/properties/${propertyId}/subscribe`} className="btn-primary" style={{ textDecoration: 'none' }}>
              Subscribe now
            </Link>
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
