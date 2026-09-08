'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// With implicit flow, Supabase's browser client automatically parses the
// access/refresh tokens out of the URL hash fragment on load (fragments
// never reach the server, hence this being a client page, not a route
// handler) and establishes the session. We just wait for that, then send
// the freshly-confirmed customer into KYC onboarding.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.replace('/onboarding');
    });

    // In case the session was already present by the time this mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/onboarding');
    });

    const timeout = setTimeout(() => setFailed(true), 6000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  if (failed) {
    return (
      <main className="container-narrow">
        <div className="card" style={{ maxWidth: 400, margin: '80px auto 0', textAlign: 'center' }}>
          <p>
            That confirmation link is invalid or has expired. If you already confirmed your
            email, just <a href="/" style={{ color: 'var(--color-accent)' }}>log in</a> —
            otherwise sign up again to get a fresh link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow">
      <div className="card" style={{ maxWidth: 400, margin: '80px auto 0', textAlign: 'center' }}>
        <p>Confirming your email…</p>
      </div>
    </main>
  );
}
