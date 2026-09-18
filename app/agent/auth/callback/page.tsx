'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Redesign 2026-09 (follow-up, round 22) — agent-side twin of
// app/auth/callback/page.tsx, same implicit-flow token handling. Routes
// on agent_profiles existing rather than profiles.first_name (a first-
// time OAuth agent has a stub profiles row from handle_new_user but no
// agent_profiles row yet — that's what sends them to /agent/onboarding
// to finish the minimal signup; a returning agent goes straight to
// /agent/dashboard, same "needs_onboarding" gate agentLogIn already uses
// for the email/password path).
export default function AgentAuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let routed = false;

    async function routeAfterSession(userId: string) {
      if (routed) return;
      routed = true;
      const { data: agentProfile } = await supabase.from('agent_profiles').select('id').eq('id', userId).maybeSingle();
      router.replace(agentProfile ? '/agent/dashboard' : '/agent/onboarding');
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) routeAfterSession(session.user.id);
    });

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
      <main className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ maxWidth: 380, textAlign: 'center', fontSize: 13.5, padding: 24 }}>
          That sign-in link is invalid or has expired. If you already signed in, just{' '}
          <a href="/agent/login" style={{ color: 'var(--color-link)' }}>log in</a> — otherwise try again from agent signup.
        </p>
      </main>
    );
  }

  return (
    <main className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13.5, padding: 24 }}>Signing you in…</p>
    </main>
  );
}
