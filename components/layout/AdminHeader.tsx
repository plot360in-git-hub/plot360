import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';
import { getAdminPendingCounts } from '@/components/admin/admin.actions';

const NAV_LINK_STYLE = {
  fontSize: 15,
  color: 'rgba(255,255,255,0.7)',
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};

function NavLink({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link href={href} style={{ ...NAV_LINK_STYLE, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span>{label}</span>
      {!!count && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: 'var(--color-danger, #d64545)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

// Same placement convention as AppHeader (brand+nav left, identity+logout
// right) but visually distinct so it's never confused with the customer
// area, and links back to the verification queue instead of the dashboard.
// Uses its own wider container (not .container-narrow, which is sized for
// page content at 900px) since a growing nav list needs more room, and
// wraps gracefully with flex-wrap instead of colliding at narrow widths.
//
// Each nav item shows a red count badge for pending work waiting on
// admin review — so as soon as an admin logs in they can see at a glance
// how much needs attention where, without opening every page.
export async function AdminHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const counts = user ? await getAdminPendingCounts() : null;

  let displayName = user?.email ?? '';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    if (name) displayName = name;
  }

  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-text)' }}>
      <div
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          rowGap: 10,
          columnGap: 16,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 8 }}>
          <Link href="/admin" style={{ fontWeight: 600, fontSize: 19, color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Plot360 <span style={{ opacity: 0.6, fontWeight: 400 }}>Admin</span>
          </Link>
          <NavLink href="/admin" label="Verification Queue" count={counts?.verification} />
          <NavLink href="/admin/renewals" label="Renewals" count={counts?.renewals} />
          <NavLink href="/admin/payments" label="Payments" count={counts?.payments} />
          <Link href="/admin/plans" style={NAV_LINK_STYLE}>Plans</Link>
          <NavLink href="/admin/agents" label="Agents" count={counts?.agents} />
          <NavLink href="/admin/monitoring" label="Monitoring" count={counts?.monitoring} />
          <Link href="/admin/users" style={NAV_LINK_STYLE}>Users</Link>
          <NavLink href="/admin/service-requests" label="Service Requests" count={counts?.serviceRequests} />
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 16, rowGap: 8 }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{displayName}</span>
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
