import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <header className="nav-sticky">
        <div
          className="container-wide"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}
        >
          <span style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em' }}>Plot360</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#how-it-works" style={{ fontSize: 15, color: 'var(--color-text)', textDecoration: 'none' }}>
              How it works
            </a>
            <a href="#security" style={{ fontSize: 15, color: 'var(--color-text)', textDecoration: 'none' }}>
              Security
            </a>
            <Link
              href="/signup"
              className="btn-primary"
              style={{ textDecoration: 'none', padding: '9px 20px', fontSize: 14 }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {params.confirm === 'failed' && (
        <div className="container-wide" style={{ paddingTop: 24 }}>
          <div className="card section-alt" style={{ borderColor: 'var(--color-danger)' }}>
            <p style={{ fontSize: 14 }}>
              That confirmation link is invalid or has expired. If you already confirmed your
              email, just log in below — otherwise sign up again to get a fresh link.
            </p>
          </div>
        </div>
      )}

      {/* Hero */}
      <section
        className="container-wide stack-on-mobile"
        style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 48, alignItems: 'center', paddingTop: 64, paddingBottom: 96 }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-link)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
            Property monitoring, simplified
          </p>
          <h1 style={{ fontSize: 48, marginBottom: 20 }}>Your property, watched over — wherever you are.</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1.55, maxWidth: 480 }}>
            Register your plots, authorize a verification visit, and access photos, videos and
            documents any time — so you don&rsquo;t have to depend on relatives or friends to
            check on your hard-earned investment.
          </p>
        </div>
        <LoginForm />
      </section>

      {/* Problem */}
      <section id="problem" className="section-alt" style={{ padding: '80px 0' }}>
        <div className="container-wide stack-on-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 32, marginBottom: 16 }}>Distance shouldn&rsquo;t mean uncertainty</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 17, lineHeight: 1.55, marginBottom: 12 }}>
              Owning property away from where you live means you can&rsquo;t just walk over and
              check on it. So the job falls on relatives or friends — an awkward favor to keep
              asking, with no real way to confirm what&rsquo;s actually happening on the ground.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 17, lineHeight: 1.55 }}>
              Plot360 replaces that arrangement with a verified record you control, whenever you
              need it.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'Repeated calls and favors just to get a status update',
              'No independent proof that your property is actually being looked after',
              'Trips home planned around checking on an investment, not living your life',
            ].map((text) => (
              <div key={text} className="card" style={{ display: 'flex', gap: 12, padding: 18 }}>
                <span style={{ color: 'var(--color-link)', fontWeight: 600 }}>✓</span>
                <span style={{ fontSize: 15.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '88px 0' }}>
        <div className="container-wide">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 56px' }}>
            <h2 style={{ fontSize: 34, marginBottom: 14 }}>How Plot360 works</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 17 }}>
              Three steps, and your property is on record — checkable any time you need it.
            </p>
          </div>
          <div className="grid-cards">
            {[
              {
                step: '01',
                title: 'Register your property',
                body: "Add your plot's details to your Plot360 account in a few minutes — no paperwork, no office visit.",
              },
              {
                step: '02',
                title: 'Authorize a verification visit',
                body: 'Sign an Approval Letter and NOC, and a Plot360 agent visits to photograph and document your property.',
              },
              {
                step: '03',
                title: 'Check in anytime',
                body: 'View verified photos, videos and documents from your dashboard whenever you want — no one else to call.',
              },
            ].map((s) => (
              <div key={s.step}>
                <p style={{ color: 'var(--color-link)', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Step {s.step}</p>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 15.5, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-alt" style={{ padding: '88px 0' }}>
        <div className="container-wide">
          <h2 style={{ fontSize: 34, textAlign: 'center', marginBottom: 48 }}>Why owners choose Plot360</h2>
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { title: 'Stress-free', body: "No more anxious calls or wondering what's really happening. One place, verified answers." },
              { title: 'Time-saving', body: 'Skip the trips home just to check on an investment. See it from wherever you are.' },
              { title: 'Cost-effective', body: "A fraction of the cost of repeated travel — without leaning on anyone else's time." },
              { title: 'Secure & private', body: "Your property's records are visible only to you — no one else can access your files." },
            ].map((b) => (
              <div key={b.title} className="card">
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>{b.title}</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 15, lineHeight: 1.5 }}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security / trust */}
      <section id="security" style={{ padding: '88px 0' }}>
        <div className="container-wide stack-on-mobile" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 32, marginBottom: 16 }}>Verification you can trust, access only you have</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 17, lineHeight: 1.55, marginBottom: 20 }}>
              Every visit is authorized in writing: an Approval Letter from the property&rsquo;s
              owner, and a Notice of Consent (NOC) for the Plot360 agent who visits to photograph
              and document it. Nothing gets recorded without your say-so.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Owner-authorized visits, on your terms',
                'Your files are private to your account, by design',
                'A dated, verifiable record — not a secondhand phone call',
              ].map((text) => (
                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15.5 }}>
                  <span style={{ color: 'var(--color-link)', fontWeight: 600 }}>✓</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card section-alt" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>Authorization on file</p>
            <p style={{ fontSize: 22, fontWeight: 600, marginTop: 8 }}>Approval Letter · NOC</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '88px 24px', borderTop: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: 36, marginBottom: 12 }}>Stop wondering. Start knowing.</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 17, marginBottom: 32 }}>
          Join the owners who check on their property in seconds — not in favors owed.
        </p>
        <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Sign up free
        </Link>
      </section>

      <footer style={{ borderTop: '1px solid var(--color-border)', padding: '32px 24px' }}>
        <div className="container-wide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontWeight: 600 }}>Plot360</span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>&copy; {new Date().getFullYear()} Plot360. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}
