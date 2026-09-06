import Link from 'next/link';
import { getPendingRenewals } from '@/components/properties/renewal/renewal.actions';
import { profileDisplayName } from './displayName';
import { RenewalDecision } from './RenewalDecision';

export async function RenewalsQueue() {
  const requests = await getPendingRenewals();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 8 }}>Renewal requests</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
        {requests.length} request{requests.length === 1 ? '' : 's'} awaiting decision
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {requests.map((r: any) => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>{r.properties?.property_name}</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                  {r.properties?.property_type} · {r.properties?.plot_size} {r.properties?.plot_size_unit} ·{' '}
                  {r.properties?.street_address}, {r.properties?.village_town}, {r.properties?.district}, {r.properties?.state}
                </p>
              </div>
              <Link href={`/admin/${r.property_id}`} style={{ color: 'var(--color-accent)', fontSize: 14, whiteSpace: 'nowrap', marginLeft: 16 }}>
                View full property
              </Link>
            </div>

            <p style={{ fontSize: 14, marginBottom: 4 }}>
              <strong>Requested by:</strong> {profileDisplayName(r.profiles)} · {r.profiles?.email}
              {r.profiles?.phone_number && ` · ${r.profiles.phone_country_code ?? ''} ${r.profiles.phone_number}`}
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Current expiration: {r.current_expiration_date ?? '—'} · Requested new date: {r.requested_expiration_date}
            </p>

            <RenewalDecision requestId={r.id} propertyId={r.property_id} requestedDate={r.requested_expiration_date} />
          </div>
        ))}
        {requests.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No pending renewal requests.</p>}
      </div>
    </div>
  );
}
