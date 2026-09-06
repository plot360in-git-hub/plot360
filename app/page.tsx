import { LoginForm } from '@/components/auth/LoginForm';

export default function HomePage() {
  return (
    <main>
      <nav className="container-narrow" style={{ display: 'flex', gap: 32, padding: '24px 0' }}>
        <span>Home</span><span>Services</span><span>About Us</span><span>Contact</span>
      </nav>
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
