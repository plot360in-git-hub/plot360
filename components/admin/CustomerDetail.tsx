import Link from 'next/link';
import { getCustomerDetail } from './users.actions';

function displayPhone(countryCode?: string | null, number?: string | null) {
  if (!number) return '—';
  return `${countryCode ?? ''} ${number}`.trim();
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending verification',
  verified: 'Verified',
  rejected: 'Rejected',
};

// Redesign 2026-09 (follow-up, 2026-11-04) — Plot: "a place to check a
// user and his registered property list" with an option to open each
// one. Mirrors AgentVerificationDetail.tsx's layout (header card + "Back
// to Users" link) — new, since no customer-side admin detail screen
// existed before this. Every row opens straight into that property's
// own existing admin page (/admin/[id]), not a new screen.
export async function CustomerDetail({ userId }: { userId: string }) {
  const { error, profile, properties } = await getCustomerDetail(userId);

  if (error || !profile) {
    return (
      <div style={{ padding: '22px 26px 30px', maxWidth: 760 }}>
        <Link href="/admin/users" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
          ← Back to Users
        </Link>
        <p style={{ marginTop: 16 }}>{error || 'Customer not found.'}</p>
      </div>
    );
  }

  const name = `${profile.firstName} ${profile.lastName}`.trim() || profile.email || 'Unknown';

  return (
    <div style={{ padding: '22px 26px 30px', maxWidth: 760 }}>
      <Link href="/admin/users" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
        ← Back to Users
      </Link>

      <div className="card" style={{ padding: 20, marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ fontSize: 22, letterSpacing: '-0.02em' }}>{name}</h2>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: profile.isBanned ? 'var(--p-alert)' : 'var(--p-ink-soft)' }}>
            {profile.isBanned ? 'Banned' : 'Active'}{profile.isAdmin ? ' · Admin' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14, fontSize: 13 }}>
          <div>
            Email: <strong>{profile.email || '—'}</strong>{' '}
            {profile.email && (
              <span style={{ color: 'var(--p-ink-soft)' }}>({profile.emailConfirmed ? 'confirmed' : 'not confirmed'})</span>
            )}
          </div>
          <div>
            Phone: <strong>{displayPhone(profile.phoneCountryCode, profile.phoneNumber)}</strong>
          </div>
          {profile.createdAt && (
            <div style={{ color: 'var(--p-ink-soft)' }}>Signed up {profile.createdAt.slice(0, 10)}</div>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginTop: 24, marginBottom: 10 }}>
        Registered properties <span style={{ color: 'var(--p-ink-soft)', fontWeight: 400 }}>({properties.length})</span>
      </h3>

      {properties.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--p-ink-soft)' }}>This customer hasn&rsquo;t registered a property yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Property', 'Location', 'Status', 'Registered', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px 8px 0',
                    borderBottom: '2px solid var(--color-divider)',
                    fontSize: 9.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((p: any) => (
              <tr key={p.id}>
                <td style={{ padding: '8px 10px 8px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{p.property_name}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>
                  {[p.village_town, p.district, p.sro_code ? `SRO ${p.sro_code}` : null].filter(Boolean).join(' · ') || '—'}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>
                  {p.created_at?.slice(0, 10)}
                </td>
                <td style={{ padding: '5px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right' }}>
                  <Link href={`/admin/${p.id}`} className="btn btn-secondary" style={{ minHeight: 28, fontSize: 11, padding: '0 10px' }}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
