import Link from 'next/link';
import { getPropertyForReview, getDocumentSignedUrl } from './admin.actions';
import { profileDisplayName } from './displayName';
import { AdminDecisionButtons } from './AdminDecisionButtons';
import { BackButton } from './BackButton';
import { AddTaskForm } from '@/components/tasks/AddTaskForm';
import { TaskList } from '@/components/tasks/TaskList';
import { getLatestPaymentForProperty } from '@/components/payments/payments.actions';
import { EcUploadForm } from './EcUploadForm';

export async function AdminReview({ propertyId }: { propertyId: string }) {
  const { property, ownership, documents } = await getPropertyForReview(propertyId);
  if (!property) return <p>Property not found.</p>;

  const [documentsWithUrls, payment] = await Promise.all([
    Promise.all(documents.map(async (d: any) => ({ ...d, url: await getDocumentSignedUrl(d.file_path) }))),
    getLatestPaymentForProperty(propertyId),
  ]);

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <BackButton />
      <h1 style={{ marginBottom: 4 }}>{property.property_name}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        Submitted by {profileDisplayName(property.profiles)} ·{' '}
        {property.profiles?.email} · {property.profiles?.phone_number}
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Property details</h3>
          <Link href={`/admin/${property.id}/edit`} style={{ color: 'var(--color-link)', fontSize: 14 }}>
            Edit property details
          </Link>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
          <div><dt className="field-label">Type</dt><dd>{property.property_type}</dd></div>
          <div><dt className="field-label">Size</dt><dd>{property.plot_size} {property.plot_size_unit}</dd></div>
          <div><dt className="field-label">Address</dt><dd>{property.street_address}, {property.village_town}, {property.district}, {property.state}</dd></div>
          <div><dt className="field-label">GPS coordinate</dt><dd>{property.plot_gps_coordinate || '—'}</dd></div>
          <div><dt className="field-label">Description</dt><dd>{property.description || '—'}</dd></div>
        </dl>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Ownership declaration</h3>
          <Link href={`/admin/${property.id}/ownership`} style={{ color: 'var(--color-link)', fontSize: 14 }}>
            Edit ownership
          </Link>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
          <div><dt className="field-label">Owner name</dt><dd>{ownership?.owner_full_name || '—'}</dd></div>
          <div><dt className="field-label">Registering user is owner</dt><dd>{ownership?.is_registered_user_owner ? 'Yes' : 'No'}</dd></div>
          <div><dt className="field-label">Agent entry allowed</dt><dd>{ownership?.agent_entry_allowed ? 'Yes' : 'No'}</dd></div>
          <div><dt className="field-label">No legal case declared</dt><dd>{ownership?.no_legal_case_declared ? 'Confirmed' : 'Not confirmed'}</dd></div>
          <div><dt className="field-label">Digital Signed EC requested</dt><dd>{ownership?.ec_digital_copy_requested ? 'Yes' : 'No'}</dd></div>
          {ownership?.ec_digital_copy_requested && (
            <>
              <div><dt className="field-label">EC Document Number</dt><dd>{ownership?.ec_document_number || '—'}</dd></div>
              <div><dt className="field-label">EC Year of Registration</dt><dd>{ownership?.ec_registration_year || '—'}</dd></div>
              <div><dt className="field-label">EC Registered at SRO</dt><dd>{ownership?.ec_registered_sro || '—'}</dd></div>
            </>
          )}
        </dl>
      </div>

      {ownership?.ec_digital_copy_requested && (
        <EcUploadForm
          propertyId={property.id}
          existingDoc={(() => {
            const ecDoc = documentsWithUrls.find((d: any) => d.doc_type === 'ec_digital_copy');
            if (!ecDoc) return null;
            const parts = ecDoc.file_path.split('/');
            return { name: parts[parts.length - 1], url: ecDoc.url };
          })()}
        />
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3>Documents</h3>
          <Link href={`/admin/${property.id}/documents`} style={{ color: 'var(--color-link)', fontSize: 14 }}>
            Edit documents
          </Link>
        </div>
        {documentsWithUrls.filter((d: any) => d.doc_type !== 'ec_digital_copy').length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>No documents uploaded.</p>
        )}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documentsWithUrls
            .filter((d: any) => d.doc_type !== 'ec_digital_copy')
            .map((d) => (
            <li key={d.id} style={{ marginBottom: 8 }}>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
                  {d.doc_type.replace(/_/g, ' ')}
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>{d.doc_type.replace(/_/g, ' ')} (link unavailable)</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Payment</h3>
          <Link href="/admin/payments" style={{ color: 'var(--color-link)', fontSize: 14 }}>Go to Payments</Link>
        </div>
        {!payment ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No payment record yet — created automatically once this property is verified.</p>
        ) : payment.status === 'completed' ? (
          <p>
            <span className="status-pill verified" style={{ marginRight: 8 }}>Completed</span>
            Valid {payment.valid_from} to {payment.valid_until}
          </p>
        ) : (
          <p><span className="status-pill pending" style={{ marginRight: 8 }}>Pending</span> Awaiting confirmation — record it from the Payments page.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Tasks</h3>
        <AddTaskForm propertyId={property.id} />
        <TaskList propertyId={property.id} />
      </div>

      <AdminDecisionButtons propertyId={property.id} currentStatus={property.status} />
    </div>
  );
}
