'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Same pattern as /auth/callback — the recovery link's tokens arrive in
// the URL hash (implicit flow), which only the browser can read. Once the
// recovery session is detected, send the user to the actual "set a new
// password" form.
export default function ResetPasswordCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) router.replace('/auth/update-password');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/auth/update-password');
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
            This reset link is invalid or has expired. Please request a new one from the{' '}
            <a href="/forgot-password" style={{ color: 'var(--color-link)' }}>forgot password</a> page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow">
      <div className="card" style={{ maxWidth: 400, margin: '80px auto 0', textAlign: 'center' }}>
        <p>Verifying your reset link…</p>
      </div>
    </main>
  );
}
