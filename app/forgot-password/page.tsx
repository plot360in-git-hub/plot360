import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="container-narrow">
      {params.error === 'expired' && (
        <div className="card section-alt" style={{ maxWidth: 400, margin: '40px auto 0', borderColor: 'var(--color-danger)' }}>
          <p style={{ fontSize: 14 }}>That reset link was invalid or has expired. Request a new one below.</p>
        </div>
      )}
      <ForgotPasswordForm />
    </main>
  );
}
