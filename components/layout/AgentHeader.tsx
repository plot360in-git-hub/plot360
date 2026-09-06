import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';

export async function AgentHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  return (
    <header style={{ borderBottom: '1px solid var(--color-border)', background: '#fff' }}>
      <div className="container-narrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link href="/agent/dashboard" style={{ fontWeight: 600, fontSize: 19, color: 'var(--color-text)', textDecoration: 'none' }}>
            Plot360 <span style={{ opacity: 0.5, fontWeight: 400 }}>Agent</span>
          </Link>
          <Link href="/agent/dashboard" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            My Jobs
          </Link>
          <Link href="/agent/profile/edit" style={{ fontSize: 15, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Edit Profile
          </Link>
        </div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>{user.email}</span>
            <form action={logOut}>
              <button type="submit" className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
