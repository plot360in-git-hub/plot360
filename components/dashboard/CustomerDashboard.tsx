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
  approved: 'Site Visit Verified',
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
    return <span className="status-pill verified">Payment Completed</span>;
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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Card display order, per product spec:
// 1 Draft · 2 Not Verified · 3 Rejected · 4 Verified+Payment Pending ·
// 5 Verified+Paid+Agent assigned · 6 Verified+Paid+Under admin review ·
// 7 Verified+Paid (no active monitoring cycle) · 8 Verified+Paid+Site verified
function getSortRank(property: any, payment: any, monitoringStatus: string | undefined): number {
  if (!property.registration_date) return 1;
  if (property.status === 'pending') return 2;
  if (property.status === 'rejected') return 3;

  const paid = payment?.status === 'completed';
  if (!paid) return 4;
  // A rejected monitoring visit sends the work back to the agent — closer
  // in spirit to "agent assigned" than to any of the other buckets.
  if (monitoringStatus === 'assigned' || monitoringStatus === 'accepted' || monitoringStatus === 'rejected') return 5;
  if (monitoringStatus === 'submitted') return 6;
  if (monitoringStatus === 'approved') return 8;
  return 7;
}

export async function CustomerDashboard() {
  const data = await getDashboardData();
  if (!data) return <p>Please sign in.</p>;

  const { profile, properties, paymentsByProperty, latestMonitoringByProperty, visitCountByProperty, maxVisitsByProperty, summary } = data;

  return (
    <div className="container-wide" style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* Header: greeting only — profile picture stays as a friendly touch,
          all identity details (username/email/phone) and the separate
          Edit Profile link were removed since the avatar+name in the top
          nav already links there. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1>{greeting()}, {profile?.first_name} {profile?.last_name}</h1>
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

      {/* Summary: total / verified / pending verification / rejected / pending payment */}
      <div className="card section-alt" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginBottom: 32 }}>
        <div>
          <p className="field-label">Total properties</p>
          <h2>{summary.total}</h2>
        </div>
        <div>
          <p className="field-label">Verified</p>
          <h2 style={{ color: '#1a7f37' }}>{summary.verified}</h2>
        </div>
        <div>
          <p className="field-label">Pending verification</p>
          <h2 style={{ color: '#b98a2a' }}>{summary.pending}</h2>
        </div>
        <div>
          <p className="field-label">Rejected</p>
          <h2 style={{ color: '#8b1e1e' }}>{summary.rejected}</h2>
        </div>
        <div>
          <p className="field-label">Pending payment</p>
          <h2 style={{ color: '#b3261e' }}>{summary.pendingPayment}</h2>
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
        {[...properties]
          .sort(
            (a, b) =>
              getSortRank(a, paymentsByProperty?.[a.id], latestMonitoringByProperty?.[a.id]) -
              getSortRank(b, paymentsByProperty?.[b.id], latestMonitoringByProperty?.[b.id])
          )
          .map((p) => {
          const isDraft = !p.registration_date;
          const payment = paymentsByProperty?.[p.id];
          const daysUntilExpiry = p.expiration_date
            ? Math.ceil((new Date(p.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          const visitsCompleted = visitCountByProperty?.[p.id] ?? 0;
          const requiredVisits = maxVisitsByProperty?.[p.id] ?? 1;
          const canRenew =
            p.status === 'verified' &&
            !!p.expiration_date &&
            visitsCompleted >= requiredVisits &&
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
                  <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-link)' }}>Continue Registration</Link>
                ) : (
                  <>
                    <Link href={`/properties/${p.id}`} style={{ color: 'var(--color-link)' }}>View</Link>
                    {p.status === 'verified' ? (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12.5 }}>Verified — contact admin to edit</span>
                    ) : (
                      <Link href={`/properties/${p.id}/edit`} style={{ color: 'var(--color-link)' }}>Edit</Link>
                    )}
                    {canRenew && (
                      <Link href={`/properties/${p.id}/renew`} style={{ color: 'var(--color-link)' }}>Renew</Link>
                    )}
                    {p.status === 'verified' && p.expiration_date && !canRenew && (
                      <span
                        style={{ color: 'var(--color-text-muted)', fontSize: 12 }}
                        title="Renew unlocks once your plan's required site verification(s) are complete and expiry is within 15 days"
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
