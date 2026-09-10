import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';
import { getMyOpenServiceRequestCount } from '@/components/service-requests/service-requests.actions';

// Standard SaaS header placement: brand + primary nav on the left,
// account identity + Log out on the far right. Reused at the top of
// every signed-in customer page (dashboard, properties, tasks, onboarding).
export async function AppHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  let displayName = user?.email ?? '';
  let initial = user?.email?.[0]?.toUpperCase() ?? '?';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
    if (name) {
      displayName = name;
      initial = name[0].toUpperCase();
    }
  }

  const openRequestCount = user ? await getMyOpenServiceRequestCount() : 0;

  return (
    <header className="nav-sticky">
      <div
        className="container-wide"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/dashboard" style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em', color: 'var(--color-text)', textDecoration: 'none' }}>
            Plot360
          </Link>
          <Link href="/dashboard" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Dashboard
          </Link>
          <Link href="/properties/new" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Add Property
          </Link>
          <Link href="/service-requests" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>Service Requests</span>
            {openRequestCount > 0 && (
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
                {openRequestCount > 99 ? '99+' : openRequestCount}
              </span>
            )}
          </Link>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/profile/edit" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span className="avatar-circle">{initial}</span>
              <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{displayName}</span>
            </Link>
            <form action={logOut}>
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: 14 }}
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
