import Link from 'next/link';
import { getPendingProperties } from './admin.actions';
import { profileDisplayName } from './displayName';

export async function AdminQueue() {
  const properties = await getPendingProperties();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 8 }}>Verification queue</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
        {properties.length} propert{properties.length === 1 ? 'y' : 'ies'} awaiting review
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {properties.map((p: any) => (
          <Link
            key={p.id}
            href={`/admin/${p.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{p.property_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                {p.property_type} · submitted by {profileDisplayName(p.profiles)} ({p.profiles?.email})
              </p>
            </div>
            <span className="status-pill pending">Review</span>
          </Link>
        ))}
        {properties.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Nothing waiting for review right now.</p>
        )}
      </div>
    </div>
  );
}
