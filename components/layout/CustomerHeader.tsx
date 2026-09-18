import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';
import { getMyOpenServiceRequestCount } from '@/components/service-requests/service-requests.actions';

// Redesign 2026-09 (follow-up) — every customer-section layout
// (app/dashboard, app/properties, app/onboarding, app/profile, app/tasks,
// app/service-requests) rendered the old pre-redesign AppHeader.tsx above
// its content, which is why the new red/black pages still had the old
// white "Plot360 | Dashboard | Add Property | ..." nav bar on top — Plot
// caught this by screenshot. This is a `.p360`-styled replacement with
// the exact same links/behavior (Dashboard, Add Property, Service
// Requests with its open-count badge, identity, Log out). AppHeader.tsx
// itself is untouched and still exists, just no longer wired into these
// six layouts — same pattern as everywhere else in this redesign.
//
// The design mock itself is a phone-only flow with no persistent top nav
// at all, so there's nothing to literally "match" here — this keeps the
// existing functional header (needed for real desktop/browser use) but
// reskins it in the Modernist system instead of inventing new navigation
// the mock never specifies.
export async function CustomerHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

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

  const openRequestCount = user ? await getMyOpenServiceRequestCount() : 0;

  return (
    <header className="p360" style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-bg)', borderBottom: '2px solid var(--color-divider)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 20, minHeight: 58, flexWrap: 'wrap' }}>
        <Link
          href="/dashboard"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, letterSpacing: '-.02em', textDecoration: 'none', color: 'var(--color-text)', flex: 'none' }}
        >
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>
        </Link>
        <nav style={{ display: 'flex', gap: 4 }}>
          <Link href="/dashboard" className="nav-link" style={{ fontSize: 13, padding: '0 10px', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            Dashboard
          </Link>
          <Link href="/properties/new" className="nav-link" style={{ fontSize: 13, padding: '0 10px', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            Add Property
          </Link>
          <Link
            href="/service-requests"
            className="nav-link"
            style={{ fontSize: 13, padding: '0 10px', minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Service Requests
            {openRequestCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  background: 'var(--color-accent)',
                  color: 'var(--color-bg)',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {openRequestCount > 99 ? '99+' : openRequestCount}
              </span>
            )}
          </Link>
        </nav>
        <div style={{ flex: 1 }} />
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/profile/edit" className="nav-link" style={{ fontSize: 13 }}>
              {displayName}
            </Link>
            <form action={logOut}>
              <button type="submit" className="btn btn-secondary" style={{ minHeight: 36, fontSize: 12.5, padding: '0 14px', fontWeight: 700 }}>
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
