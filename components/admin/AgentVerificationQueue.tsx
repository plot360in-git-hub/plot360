import Link from 'next/link';
import { getPendingAgents } from './agents.actions';
import { profileDisplayName } from './displayName';

export async function AgentVerificationQueue() {
  const agents = await getPendingAgents();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 8 }}>Agent Verification</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>
        {agents.length} agent{agents.length === 1 ? '' : 's'} awaiting review
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {agents.map((a: any) => (
          <Link
            key={a.id}
            href={`/admin/agents/${a.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{profileDisplayName(a.profiles)}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                {a.profiles?.email} · {a.profiles?.phone_country_code} {a.profiles?.phone_number}
              </p>
            </div>
            <span className="status-pill pending">Review</span>
          </Link>
        ))}
        {agents.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No agents awaiting review.</p>}
      </div>
    </div>
  );
}
