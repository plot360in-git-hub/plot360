import { LoginForm } from '@/components/auth/LoginForm';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <nav className="container-narrow" style={{ display: 'flex', gap: 32, padding: '24px 0' }}>
        <span>Home</span><span>Services</span><span>About Us</span><span>Contact</span>
      </nav>
      {params.confirm === 'failed' && (
        <div className="container-narrow" style={{ paddingTop: 24 }}>
          <div className="card section-alt" style={{ borderColor: 'var(--color-danger)' }}>
            <p style={{ fontSize: 14 }}>
              That confirmation link is invalid or has expired. If you already confirmed your
              email, just log in below — otherwise sign up again to get a fresh link.
            </p>
          </div>
        </div>
      )}
      <section className="container-narrow" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, paddingTop: 40, paddingBottom: 80 }}>
        <div>
          <h1 style={{ fontSize: 48, marginBottom: 16 }}>Your properties, verified and always on hand.</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Register your plots, upload verification photos and documents, and track
            everything from one place.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
