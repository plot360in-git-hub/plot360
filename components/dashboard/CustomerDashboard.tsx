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

function paymentBadge(payment: any) {
  if (!payment) return <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>;
  if (payment.status === 'completed') {
    return <span className="status-pill verified">Completed</span>;
  }
  return <span className="status-pill pending">Pending</span>;
}

export async function CustomerDashboard() {
  const data = await getDashboardData();
  if (!data) return <p>Please sign in.</p>;

  const { profile, properties, paymentsByProperty, latestMonitoringByProperty, visitCountByProperty, summary } = data;

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
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

      {/* Summary: total / verified / pending / upcoming tasks */}
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

      {/* Property listing table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3>Your properties</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/properties/new" className="btn-primary" style={{ textDecoration: 'none' }}>Add New Property</Link>
          <Link href="/tasks" className="btn-primary" style={{ textDecoration: 'none' }}>View All Tasks</Link>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 14 }}>
            <th style={{ padding: '8px 0' }}>Property</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Valid until / Next due</th>
            <th>Monitoring</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
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
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 0' }}>{p.property_name}</td>
                <td>
                  {isDraft ? (
                    <span className="status-pill pending">Draft</span>
                  ) : (
                    <span className={`status-pill ${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                  )}
                </td>
                <td>{isDraft ? '—' : paymentBadge(payment)}</td>
                <td>
                  {p.expiration_date ?? (payment?.status === 'pending' ? 'Awaiting payment' : '—')}
                </td>
                <td>
                  {latestMonitoringByProperty?.[p.id] ? (
                    <span className={`status-pill ${MONITORING_STATUS_CLASS[latestMonitoringByProperty[p.id]] ?? 'pending'}`}>
                      {MONITORING_STATUS_LABEL[latestMonitoringByProperty[p.id]] ?? latestMonitoringByProperty[p.id]}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {isDraft ? (
                    <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-accent)' }}>Continue Registration</Link>
                  ) : (
                    <>
                      <Link href={`/properties/${p.id}`} style={{ color: 'var(--color-accent)', marginRight: 12 }}>View</Link>
                      {p.status === 'verified' ? (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 13, marginRight: 12 }}>
                          Verified — contact admin to edit
                        </span>
                      ) : (
                        <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-accent)', marginRight: 12 }}>Edit</Link>
                      )}
                      {canRenew && (
                        <Link href={`/properties/${p.id}/renew`} style={{ color: 'var(--color-accent)' }}>Renew</Link>
                      )}
                      {p.status === 'verified' && p.expiration_date && !canRenew && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }} title="Renew unlocks once 2 site verifications are complete and expiry is within 15 days">
                          Renew (not yet available)
                        </span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {properties.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '24px 0', color: 'var(--color-text-muted)' }}>No properties yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
