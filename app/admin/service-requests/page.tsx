import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getAllServiceRequests } from '@/components/service-requests/service-requests.actions';

function profileDisplayName(p: any) {
  if (!p) return 'Unknown';
  const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return name || p.email || 'Unknown';
}

export default async function AdminServiceRequestsPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const requests = await getAllServiceRequests();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 32 }}>Service Requests</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map((r: any) => (
          <Link
            key={r.id}
            href={`/admin/service-requests/${r.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{r.subject}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {profileDisplayName(r.profiles)}
                {r.properties?.property_name ? ` · ${r.properties.property_name}` : ''} · Updated {r.updated_at?.slice(0, 10)}
              </p>
            </div>
            <span className={`status-pill ${r.status === 'closed' ? 'rejected' : 'pending'}`}>
              {r.status === 'closed' ? 'Closed' : 'Open'}
            </span>
          </Link>
        ))}
        {requests.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No service requests.</p>}
      </div>
    </div>
  );
}
