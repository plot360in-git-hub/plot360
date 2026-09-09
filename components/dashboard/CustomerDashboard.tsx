import Link from 'next/link';
import { getDashboardData } from './dashboard.data';

const STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  pending: 'Not Verified',
  rejected: 'Rejected',
};

const MONITORING_STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned',
  accepted: 'Agent assigned',
  submitted: 'Under admin review',
  approved: 'Verified',
  rejected: 'Changes requested',
};
const MONITORING_STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
};

function paymentBadge(payment: any, propertyStatus: string, propertyId: string) {
  if (payment?.status === 'completed') {
    return <span className="status-pill verified">Completed</span>;
  }
  // Not yet submitted proof (no payment row, or a blank pending one) —
  // make it a direct link to the subscribe page instead of a static "—"
  // or "Pending" pill, so the customer doesn't need to open the property
  // and scroll down to find the action.
  if (propertyStatus === 'verified' && !payment?.transaction_reference) {
    return (
      <Link
        href={`/properties/${propertyId}/subscribe`}
        className="status-pill pending"
        style={{ textDecoration: 'none', cursor: 'pointer' }}
      >
        Payment Pending — Subscribe
      </Link>
    );
  }
  // Already submitted proof, waiting on admin — nothing left to click.
  if (payment?.transaction_reference) {
    return <span className="status-pill pending">Awaiting Confirmation</span>;
  }
  return <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>;
}

export async function CustomerDashboard() {
  const data = await getDashboardData();
  if (!data) return <p>Please sign in.</p>;

  const { profile, properties, paymentsByProperty, latestMonitoringByProperty, visitCountByProperty, summary } = data;

  return (
    <div className="container-wide" style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* Header: full name / username / email / phone + profile picture */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1>{profile?.first_name} {profile?.last_name}</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            @{profile?.username} · {profile?.email} · {profile?.phone_country_code} {profile?.phone_number}
          </p>
          <Link href="/profile/edit" style={{ fontSize: 14, color: 'var(--color-accent)' }}>Edit Profile</Link>
        </div>
        {profile?.profile_picture_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profile_picture_url}
            alt="Profile"
            width={72}
            height={72}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
      </div>

      {/* Summary: total / verified / pending */}
      <div className="card section-alt" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
        <div>
          <p className="field-label">Total properties</p>
          <h2>{summary.total}</h2>
        </div>
        <div>
          <p className="field-label">Verified</p>
          <h2>{summary.verified}</h2>
        </div>
        <div>
          <p className="field-label">Pending verification</p>
          <h2>{summary.pending}</h2>
        </div>
      </div>

      {/* Property listing */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>Your properties</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/properties/new" className="btn-primary" style={{ textDecoration: 'none' }}>Add New Property</Link>
          <Link href="/tasks" className="btn-primary" style={{ textDecoration: 'none' }}>View All Tasks</Link>
        </div>
      </div>

      <div className="grid-cards" style={{ marginBottom: 40 }}>
        {properties.map((p) => {
          const isDraft = !p.registration_date;
          const payment = paymentsByProperty?.[p.id];
          const daysUntilExpiry = p.expiration_date
            ? Math.ceil((new Date(p.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          const visitsCompleted = visitCountByProperty?.[p.id] ?? 0;
          const canRenew =
            p.status === 'verified' &&
            !!p.expiration_date &&
            visitsCompleted >= 2 &&
            daysUntilExpiry !== null &&
            daysUntilExpiry <= 15;

          return (
            <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {isDraft ? (
                  <span className="status-pill pending">Draft</span>
                ) : (
                  <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                )}
                {!isDraft && paymentBadge(payment, p.status, p.id)}
              </div>

              <h4 style={{ margin: 0 }}>{p.property_name}</h4>

              <p style={{ fontSize: 13.5, color: 'var(--color-text-muted)', margin: 0 }}>
                {p.expiration_date
                  ? `Valid until ${p.expiration_date}`
                  : payment?.status === 'pending'
                  ? 'Awaiting payment'
                  : isDraft
                  ? 'Registration incomplete'
                  : '—'}
              </p>

              {p.status === 'rejected' && p.rejection_reason && (
                <p style={{ fontSize: 12.5, color: 'var(--color-danger)', margin: 0 }}>
                  {p.rejection_reason.length > 80 ? `${p.rejection_reason.slice(0, 80)}…` : p.rejection_reason}
                </p>
              )}

              {latestMonitoringByProperty?.[p.id] && (
                <span
                  className={`status-pill ${MONITORING_STATUS_CLASS[latestMonitoringByProperty[p.id]] ?? 'pending'}`}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {MONITORING_STATUS_LABEL[latestMonitoringByProperty[p.id]] ?? latestMonitoringByProperty[p.id]}
                </span>
              )}

              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: 14,
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 14,
                }}
              >
                {isDraft ? (
                  <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-accent)' }}>Continue Registration</Link>
                ) : (
                  <>
                    <Link href={`/properties/${p.id}`} style={{ color: 'var(--color-accent)' }}>View</Link>
                    {p.status === 'verified' ? (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12.5 }}>Verified — contact admin to edit</span>
                    ) : (
                      <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-accent)' }}>Edit</Link>
                    )}
                    {canRenew && (
                      <Link href={`/properties/${p.id}/renew`} style={{ color: 'var(--color-accent)' }}>Renew</Link>
                    )}
                    {p.status === 'verified' && p.expiration_date && !canRenew && (
                      <span
                        style={{ color: 'var(--color-text-muted)', fontSize: 12 }}
                        title="Renew unlocks once 2 site verifications are complete and expiry is within 15 days"
                      >
                        Renew (not yet available)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        <Link href="/properties/new" className="ghost-card">
          <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Add another property</span>
        </Link>
      </div>

      {properties.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: -24, marginBottom: 40 }}>No properties yet — add your first one above.</p>
      )}
    </div>
  );
}
