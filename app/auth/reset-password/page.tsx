import { createClient } from '@/lib/supabase/server';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();

  let exchangeFailed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) exchangeFailed = true;
  } else {
    exchangeFailed = true;
  }

  if (exchangeFailed) {
    return (
      <main className="container-narrow">
        <div className="card" style={{ maxWidth: 400, margin: '80px auto 0', textAlign: 'center' }}>
          <p>
            This reset link is invalid or has expired. Please request a new one from the{' '}
            <a href="/forgot-password" style={{ color: 'var(--color-accent)' }}>forgot password</a> page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow">
      <UpdatePasswordForm />
    </main>
  );
}