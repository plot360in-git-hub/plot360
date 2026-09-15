'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// With implicit flow, Supabase's browser client automatically parses the
// access/refresh tokens out of the URL hash fragment on load (fragments
// never reach the server, hence this being a client page, not a route
// handler) and establishes the session. We just wait for that, then route
// on.
//
// Redesign 2026-09 (follow-up) — this used to unconditionally send every
// arrival here to /onboarding, which was correct when the only thing that
// ever landed here was a brand-new email/password signup clicking their
// confirmation link. Now that AuthScreen.tsx's Google/Facebook buttons
// also redirect back here, and every OAuth login (not just the first one)
// comes through this same page, a returning user would get sent through
// KYC onboarding again on every login. So: check whether the stub
// profiles row (handle_new_user, supabase/schema.sql) has actually been
// filled in yet, and only send genuinely new users to /onboarding.
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let routed = false;

    async function routeAfterSession(userId: string) {
      if (routed) return;
      routed = true;
      const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', userId).maybeSingle();
      router.replace(profile?.first_name ? '/dashboard' : '/onboarding');
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) routeAfterSession(session.user.id);
    });

    // In case the session was already present by the time this mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeAfterSession(data.session.user.id);
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
            email, just <a href="/login" style={{ color: 'var(--color-link)' }}>log in</a> —
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
