import Link from 'next/link';
import { getMyServiceRequests } from '@/components/service-requests/service-requests.actions';

export default async function ServiceRequestsPage() {
  const requests = await getMyServiceRequests();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1>Service Requests</h1>
        <Link href="/service-requests/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          New Request
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r: any) => (
          <Link
            key={r.id}
            href={`/service-requests/${r.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{r.subject}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {r.properties?.property_name ? `${r.properties.property_name} · ` : ''}
                Updated {r.updated_at?.slice(0, 10)}
              </p>
            </div>
            <span className={`status-pill ${r.status === 'closed' ? 'rejected' : 'pending'}`}>
              {r.status === 'closed' ? 'Closed' : 'Open'}
            </span>
          </Link>
        ))}
        {requests.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No service requests yet.</p>}
      </div>
    </div>
  );
}
