import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';

// Standard SaaS header placement: brand + primary nav on the left,
// account identity + Log out on the far right. Reused at the top of
// every signed-in customer page (dashboard, properties, tasks, onboarding).
export async function AppHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-border)',
        background: '#fff',
      }}
    >
      <div
        className="container-narrow"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/dashboard" style={{ fontWeight: 600, fontSize: 19, color: 'var(--color-text)', textDecoration: 'none' }}>
            Plot360
          </Link>
          <Link href="/dashboard" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Dashboard
          </Link>
          <Link href="/properties/new" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Add Property
          </Link>
          <Link href="/service-requests" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Service Requests
          </Link>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/profile/edit" style={{ fontSize: 14, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
              {user.email}
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
