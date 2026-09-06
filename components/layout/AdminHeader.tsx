import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';

const NAV_LINK_STYLE = {
  fontSize: 15,
  color: 'rgba(255,255,255,0.7)',
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};

// Same placement convention as AppHeader (brand+nav left, identity+logout
// right) but visually distinct so it's never confused with the customer
// area, and links back to the verification queue instead of the dashboard.
// Uses its own wider container (not .container-narrow, which is sized for
// page content at 900px) since a growing nav list needs more room, and
// wraps gracefully with flex-wrap instead of colliding at narrow widths.
export async function AdminHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-text)' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          rowGap: 10,
          columnGap: 24,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 20, rowGap: 8 }}>
          <Link href="/admin" style={{ fontWeight: 600, fontSize: 19, color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Plot360 <span style={{ opacity: 0.6, fontWeight: 400 }}>Admin</span>
          </Link>
          <Link href="/admin" style={NAV_LINK_STYLE}>Verification Queue</Link>
          <Link href="/admin/renewals" style={NAV_LINK_STYLE}>Renewals</Link>
          <Link href="/admin/payments" style={NAV_LINK_STYLE}>Payments</Link>
          <Link href="/admin/agents" style={NAV_LINK_STYLE}>Agents</Link>
          <Link href="/admin/monitoring" style={NAV_LINK_STYLE}>Monitoring</Link>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 16, rowGap: 8 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{user.email}</span>
            <form action={logOut}>
              <button
                type="submit"
                style={{
                  padding: '8px 20px',
                  fontSize: 14,
                  borderRadius: 'var(--radius-button)',
                  border: '1px solid var(--color-accent)',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
