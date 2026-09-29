import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logOut } from '@/components/auth/auth.actions';

// Android app (TWA) — where the app sends anything outside the customer
// experience: /admin/*, /agent/*, /m/* (see the app-mode guard in
// app/layout.tsx), and agent accounts that sign in through the app (see
// app/app-launch/route.ts). The app is customer-only; agents and admins
// keep using the website in a normal browser.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Plot360' };

export default async function AppOnlyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  let isAgent = false;
  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_agent')
      .eq('id', data.user.id)
      .single();
    isAgent = !!profile?.is_agent;
  }

  return (
    <main
      className="p360"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, marginBottom: 18 }}>PLOT360</div>
        <h1 style={{ fontSize: 22, margin: '0 0 10px' }}>
          {isAgent ? 'This app is for customers' : 'Not available in the app'}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--p-ink-soft)', margin: '0 0 24px', lineHeight: 1.5 }}>
          {isAgent
            ? 'Field agent accounts can’t be used in the Plot360 app. Please sign in to plot360.in in your phone’s browser to see your jobs.'
            : 'This page is only available on the Plot360 website. Everything for your properties is on your dashboard.'}
        </p>

        {isAgent ? (
          <form action={logOut}>
            <button type="submit" className="btn btn-primary btn-block" style={{ minHeight: 48 }}>
              Log out
            </button>
          </form>
        ) : (
          <Link
            href={data.user ? '/dashboard' : '/login'}
            className="btn btn-primary btn-block"
            style={{ minHeight: 48, textDecoration: 'none' }}
          >
            {data.user ? 'Go to my dashboard' : 'Log in'}
          </Link>
        )}
      </div>
    </main>
  );
}
