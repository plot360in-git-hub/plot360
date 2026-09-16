'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Archivo } from 'next/font/google';
import { submitEnquiry } from './enquiries.actions';
import { WA_LINK, TEL_LINK, DISPLAY_PHONE, SUPPORT_EMAIL } from '@/lib/contact';

// Redesign 2026-09 — public landing page (design_handoff_plot360_redesign/
// design/Plot360 Landing.dc.html). Ported 1:1 for copy, structure and the
// Modernist design tokens (styles/plot360-redesign.css, scoped under
// .p360 so it never touches the pre-redesign app's own --color-accent
// etc.). See ARCHITECTURE.md "Redesign 2026-09" for the mapping notes.
// Contact placeholders (WhatsApp/phone/email) live in lib/contact.ts —
// shared with the customer app's confirmation screens.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--p360-font-archivo',
  display: 'swap',
});

// Plot asked for "How it works" to come before "Services", both in the
// page order and in this top menu, so the two stay in sync.
const MENU = [
  { label: 'Home', href: '#home' },
  { label: 'How it works', href: '#how' },
  { label: 'Services', href: '#services' },
  { label: 'FAQs', href: '#faqs' },
  { label: 'Contact', href: '#contact' },
];

const STATS = [
  { n: '10', label: 'fixed checks on every visit' },
  { n: '18+', label: 'photographs and video per report' },
  { n: '1 year', label: 'to use your visit credits' },
  { n: '1 day', label: 'to hear from a representative' },
];

const SERVICES: { n: string; title: string; body: string; priced?: boolean }[] = [
  {
    n: '01',
    title: 'Site Visit and Report',
    body: 'A verified agent walks the plot, photographs all four boundaries, records video and answers the ten on-site checks. You receive a written report.',
    priced: true,
  },
  { n: '02', title: 'Cleaning Plot', body: 'If any debris cleaning or removal of grass and small plants, we make it a neat and clean look of your plot.' },
  { n: '03', title: 'Boundary Marks', body: 'Want to erect boundary stones or markers — that can be done.' },
  { n: '04', title: 'Compound wall construction', body: 'We will do compound wall construction, or connect you with precast vendors to complete your work.' },
  { n: '05', title: 'Survey', body: 'Getting your plot surveyed with a registered surveyor, and providing a report.' },
  {
    n: '06',
    title: 'Paid Document review check',
    body: 'If you want to verify your existing documentation, we will help you connect with experienced document writers to get it done.',
  },
  {
    n: '07',
    title: 'Connecting with Legal Advisor',
    body: 'If you need help legally or are looking for lawyers, we will help you connect so that you can work with them.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Name your property',
    body: 'One field is required. Location, size and a map pin are optional — a representative collects whatever is missing on WhatsApp.',
  },
  { n: '02', title: 'Choose visits and pay', body: 'One visit, or four usable any time within a year. Pay by UPI for instant confirmation, or by bank transfer.' },
  {
    n: '03',
    title: 'A representative takes over',
    body: 'We collect documents, confirm ownership, verify the property and assign an agent matched to your sub-registrar office. Nothing is expected from you.',
  },
  {
    n: '04',
    title: 'Your report arrives',
    body: 'Photographs, video, the ten answers and our review comments — in the app and as a PDF you can forward to a bank or a buyer.',
  },
];

const PLANS = [
  {
    name: '1 site visit',
    price: '₹1,999',
    was: '₹2,499',
    tag: '',
    border: '1px solid var(--color-divider)',
    body: 'One agent visit with photographs, video and a written report. Best for a one-off check before a decision.',
  },
  {
    name: '4 site visits',
    price: '₹7,497',
    was: '₹9,996',
    tag: 'Most taken',
    border: '2px solid var(--color-accent)',
    body: 'Four visits, usable any time within one year against the same property. Best for land you want watched through the year.',
  },
];

const FAQS: [string, string][] = [
  [
    'Do I have to be present for the visit?',
    'No. That is the point of the service. A verified Plot360 agent visits on your behalf and the report reaches you here and on WhatsApp. You never need to travel to the site or meet the agent.',
  ],
  [
    'What exactly do I get after a visit?',
    'Photographs of every boundary, at least one video, answers to ten fixed on-site checks, the agent’s written observations and a Plot360 review comment — as a four-page PDF. If you asked for an encumbrance certificate at registration, it is attached as the last page.',
  ],
  [
    'How soon does someone visit?',
    'You pick a start date and a window of three, five or seven working days. A representative confirms the exact day a morning ahead. Weekends are not visited.',
  ],
  [
    'Do the visits expire?',
    'Visit credits are usable for one year from payment. We remind you on WhatsApp when under sixty days remain, and a representative can extend a lapsed plan once on request.',
  ],
  [
    'What if the report shows a problem?',
    'We flag it plainly — debris, encroachment, a missing boundary stone, a municipal notice — with photographs. Plot360 can then arrange a clearing visit or a written notice to a neighbouring owner. We do not give legal opinions; for title questions, consult an advocate.',
  ],
  [
    'Which areas do you cover?',
    'Ranga Reddy district and the greater Hyderabad area, matched to the sub-registrar office your plot falls under. Ask on WhatsApp about a location outside this and we will tell you honestly whether we can reach it.',
  ],
  ['How do I pay?', 'UPI, which confirms immediately, or bank transfer, which we confirm within a working day. Nothing is charged again until you buy more visits.'],
  [
    'What do the other services cost?',
    'Only the site visit has a fixed price. Plot cleaning, boundary marks, compound wall construction, survey, document review and connecting you with a legal advisor all depend on the plot — its size, its condition and how far it is. Message us on WhatsApp with the location and we quote before any work starts.',
  ],
  [
    'Can I ask for cleaning or boundary stones after a visit?',
    'Yes, and that is the usual order. The visit report shows what the plot needs — debris at a corner, a buried boundary stone — and you can then ask for that work. We quote against the photographs, so you can see what you are paying for.',
  ],
  [
    'Do you build compound walls yourselves?',
    'We carry out compound wall construction, and where a precast wall suits the plot better we connect you with vendors we work with. Either way a Plot360 representative stays on the job and reports progress to you.',
  ],
  [
    'Who does the survey and the document work?',
    'Surveys are done by a registered surveyor and you receive their report. For document review we connect you with experienced document writers, and for legal questions with lawyers. Plot360 is not a broker, valuer, title-verification authority or law firm — we arrange the right person and stay accountable for the coordination.',
  ],
];

const CONTACT_ROWS = [
  { k: 'WhatsApp', v: DISPLAY_PHONE },
  { k: 'Phone', v: DISPLAY_PHONE },
  { k: 'Email', v: SUPPORT_EMAIL },
  { k: 'Hours', v: 'Monday to Saturday, 9:30 to 18:30 IST' },
];

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitEnquiry(formData);
      if (result?.error) setError(result.error);
      else setSent(true);
    });
  }

  return (
    <div className={`p360 ${archivo.variable}`}>
      {/* ---------- Header ---------- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-bg)', borderBottom: '2px solid var(--color-divider)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 56 }}>
          <a
            href="#home"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, letterSpacing: '-.02em', textDecoration: 'none', color: 'var(--color-text)', flex: 'none' }}
          >
            PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>
          </a>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Plot pointed out Log in was rendering as a plain text link
                next to two real buttons — given its own button treatment
                (outline, matching the hero's secondary CTAs) so it reads
                as a third action, not an afterthought. */}
            <Link
              href="/login"
              className="btn"
              style={{ border: '1px solid var(--color-divider)', color: 'var(--color-text)', minHeight: 44, fontSize: 12.5, padding: '0 14px', whiteSpace: 'nowrap' }}
            >
              Log in
            </Link>
            <Link href="/signup" className="btn btn-secondary" style={{ minHeight: 44, fontSize: 12.5, padding: '0 14px', whiteSpace: 'nowrap' }}>
              Sign up
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ minHeight: 44, fontSize: 12.5, padding: '0 14px' }}>
              WhatsApp
            </a>
          </div>
        </div>
        {/* Plot asked for the rule between the PLOT360 logo row and this
            menu row to go — removed the borderTop that used to sit here. */}
        <nav style={{ maxWidth: 1180, margin: '0 auto', padding: '0 12px', display: 'flex', overflowX: 'auto' }}>
          {MENU.map((m) => (
            <a key={m.href} href={m.href} className="nav-link" style={{ padding: '12px 12px', fontSize: 13, whiteSpace: 'nowrap' }}>
              {m.label}
            </a>
          ))}
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      {/* Redesign 2026-09 (follow-up, round 7) — was a full-bleed solid
          accent-colored band (white text throughout). Plot pointed at the
          soft pastel-gradient card on facebook.com/developers as the look
          to go for, so this is now an inset var(--gradient-hero) card with
          dark text, matching the same treatment given to the customer
          Home poster and the "done" confirmation screens. Every child that
          assumed "light text on a solid dark background" is flipped here:
          the primary CTA (was inverse light-bg/accent-text → now solid
          btn-primary), the two outline CTAs (were light border/light text
          for a dark bg → now var(--color-divider)/var(--color-text)), the
          "Open your account" link (was nav-link-inverse → now plain
          nav-link, since nav-link-inverse assumes a dark surface), and the
          stats divider + placeholder image border (were the translucent
          on-dark rule var(--p-on-dark-rule) → now var(--color-divider)). */}
      <section id="home" style={{ padding: '20px 22px 0' }}>
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
            background: 'var(--gradient-hero)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px 22px 44px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: 30,
              alignItems: 'start',
            }}
          >
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--color-accent-700)' }}>
                Site visits across Ranga Reddy &amp; Hyderabad
              </div>
              <h1
                style={{
                  fontSize: 'clamp(38px, 6vw, 62px)',
                  lineHeight: 0.98,
                  letterSpacing: '-.04em',
                  margin: '20px 0 0',
                  color: 'var(--color-text)',
                }}
              >
                Someone stands on your land, so you don&rsquo;t have to.
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.55, margin: '18px 0 0', maxWidth: '34em', color: 'var(--p-ink-soft)' }}>
                A verified Plot360 agent visits your plot, photographs every boundary, records a video and answers ten fixed checks. You get a written report — and a
                representative who handles the paperwork on WhatsApp.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                <Link href="/signup" className="btn btn-primary" style={{ minHeight: 50, fontSize: 14.5, padding: '0 20px' }}>
                  Sign up and register a plot →
                </Link>
                <Link href="/login" className="btn" style={{ border: '1px solid var(--color-divider)', color: 'var(--color-text)', minHeight: 50, fontSize: 14.5, padding: '0 20px' }}>
                  Log in
                </Link>
                <a href="#how" className="btn" style={{ border: '1px solid var(--color-divider)', color: 'var(--color-text)', minHeight: 50, fontSize: 14.5, padding: '0 20px' }}>
                  How it works
                </a>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 12, color: 'var(--p-ink-soft)' }}>
                Already paid?{' '}
                <Link href="/login" className="nav-link" style={{ textDecoration: 'underline' }}>
                  Open your account
                </Link>{' '}
                to see reports and schedule the next visit.
              </div>
            </div>
            <div style={{ minHeight: 240, position: 'relative', width: '100%' }}>
              {/* No photography is included in the handoff — every image is a
                  placeholder for the owner to supply (see README "Assets"). */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: 240,
                  background: 'rgba(255,255,255,.55)',
                  border: '1px solid var(--color-divider)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--color-neutral-800)' }}>Photograph of a plot or an agent on site</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(50%, 160px), 1fr))', gap: 0, marginTop: 44, borderTop: '2px solid var(--color-divider)' }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ padding: '18px 18px 0 0' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, letterSpacing: '-.02em' }}>{s.n}</div>
                <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 4, color: 'var(--p-ink-soft)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ----------
          Redesign 2026-09 (follow-up, round 8) — Plot asked for this to
          come before Services, both here and in the top menu (see MENU
          above), so people see how the service works before what it
          costs. */}
      <section id="how" style={{ maxWidth: 1180, margin: '0 auto', padding: '58px 22px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', borderBottom: '2px solid var(--color-divider)', paddingBottom: 12 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', letterSpacing: '-.03em' }}>How it works</h2>
          <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>You fill in one field. We do the rest.</div>
        </div>
        {STEPS.map((st) => (
          <div key={st.n} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 64px) minmax(0, 1fr)', gap: 20, padding: '20px 0', borderBottom: '1px solid var(--color-divider)', alignItems: 'start' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: 'var(--color-accent)', letterSpacing: '-.02em' }}>{st.n}</div>
            <div>
              <h3 style={{ fontSize: 20, letterSpacing: '-.01em' }}>{st.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--p-ink-soft)', margin: '6px 0 0', maxWidth: '52em' }}>{st.body}</p>
            </div>
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 18, marginTop: 30 }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{ border: p.border, borderRadius: 'var(--radius-md)', padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19 }}>{p.name}</div>
                {p.tag && <span className="tag tag-accent">{p.tag}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32, letterSpacing: '-.02em', color: 'var(--color-accent-700)' }}>
                  {p.price}
                  {/* Redesign 2026-09 (follow-up, round 8) — Plot asked for a
                      small asterisk marking the price as conditional; see
                      the footnote below the plans grid for what it points to. */}
                  <span style={{ fontSize: 15, fontWeight: 600 }}>*</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--p-ink-soft)', textDecoration: 'line-through' }}>{p.was}</div>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--p-ink-soft)', margin: '9px 0 0' }}>{p.body}</p>
              <Link href="/signup" className="btn btn-primary btn-block" style={{ minHeight: 46, fontSize: 13.5, marginTop: 16 }}>
                Sign up and buy
              </Link>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 12 }}>
          Prices shown are indicative. Encumbrance certificate available on request at registration. *Price may change based on plot size and other factors.
        </div>
      </section>

      {/* ---------- Services ----------
          Redesign 2026-09 (follow-up, round 8) — Plot asked to drop the
          shared-border "table" look (one bordered grid with dividers
          between cells) in favor of individual cards with real gaps
          between them, using the same .card class (bordered, rounded,
          var(--color-surface) background) the rest of the app now uses. */}
      <section id="services" style={{ maxWidth: 1180, margin: '0 auto', padding: '52px 22px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', borderBottom: '2px solid var(--color-divider)', paddingBottom: 12 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', letterSpacing: '-.03em' }}>Services</h2>
          <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>Seven services for owners who live away from their plot</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 18, marginTop: 20 }}>
          {SERVICES.map((s) => (
            <div key={s.n} className="card" style={{ padding: '22px 22px 26px' }}>
              <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'var(--color-accent-700)' }}>{s.n}</div>
              <h3 style={{ fontSize: 19, letterSpacing: '-.01em', margin: '9px 0 0' }}>{s.title}</h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--p-ink-soft)', margin: '7px 0 0' }}>{s.body}</p>
              <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid var(--color-divider)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: s.priced ? 'var(--color-accent-700)' : 'var(--p-ink-soft)', fontWeight: 600 }}>
                  {s.priced ? 'From ₹1,999' : 'Price on request'}
                </div>
                <a href={s.priced ? '#how' : '#contact'} className="btn btn-ghost" style={{ minHeight: 44, fontSize: 12.5, padding: '0 10px' }}>
                  {s.priced ? 'See plans →' : 'Contact support →'}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FAQs ---------- */}
      <section id="faqs" style={{ maxWidth: 1180, margin: '0 auto', padding: '52px 22px 0' }}>
        <div style={{ borderBottom: '2px solid var(--color-divider)', paddingBottom: 12 }}>
          <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', letterSpacing: '-.03em' }}>FAQs</h2>
        </div>
        {FAQS.map(([q, a], i) => {
          const open = openFaq === i;
          return (
            <div key={q} style={{ borderBottom: '1px solid var(--color-divider)' }}>
              <button
                type="button"
                onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '17px 0', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, lineHeight: 1.4 }}>{q}</span>
                <span style={{ flex: 'none', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, color: 'var(--color-accent)', lineHeight: 1.2 }}>{open ? '−' : '+'}</span>
              </button>
              {open && (
                <p style={{ fontSize: 14, lineHeight: 1.62, color: 'var(--p-ink-soft)', margin: '0 0 18px', maxWidth: '56em' }}>{a}</p>
              )}
            </div>
          );
        })}
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" style={{ marginTop: 52, background: 'var(--color-text)', color: 'var(--color-bg)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '46px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 38, alignItems: 'start' }}>
          <div>
            <h2 style={{ fontSize: 'clamp(26px, 3.6vw, 36px)', letterSpacing: '-.03em', color: 'var(--color-bg)' }}>Contact</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: '12px 0 0', maxWidth: '34em' }}>
              Tell us the plot and we will call you back. Most owners find WhatsApp fastest — send the location and we take it from there.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ minHeight: 46, fontSize: 13.5, padding: '0 18px' }}>
                WhatsApp {DISPLAY_PHONE}
              </a>
              <a href={TEL_LINK} className="btn" style={{ minHeight: 46, fontSize: 13.5, padding: '0 18px', border: '1px solid var(--p-on-dark-rule)', color: 'var(--color-bg)' }}>
                Call {DISPLAY_PHONE}
              </a>
            </div>
            <div style={{ marginTop: 26, borderTop: '1px solid var(--p-on-dark-rule)' }}>
              {CONTACT_ROWS.map((c) => (
                <div key={c.k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 110px) minmax(0, 1fr)', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--p-on-dark-rule)', fontSize: 13.5 }}>
                  <div style={{ opacity: 0.7 }}>{c.k}</div>
                  <div>{c.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', padding: 24 }}>
            {sent ? (
              <div>
                <div style={{ width: 40, height: 40, background: 'var(--color-accent)' }} />
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', marginTop: 16 }}>Thank you. We will call you.</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--p-ink-soft)', margin: '9px 0 0' }}>
                  A Plot360 representative replies within one working day, usually on WhatsApp. Nothing more is needed from you right now.
                </p>
                <button type="button" className="btn btn-secondary" style={{ minHeight: 42, fontSize: 13, marginTop: 16 }} onClick={() => setSent(false)}>
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form action={handleSubmit}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19 }}>Request a call back</div>
                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="enquiry-name">Your name</label>
                  <input className="input" style={{ minHeight: 44 }} id="enquiry-name" name="name" placeholder="Ravi Kumar" required />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="enquiry-mobile">Mobile number</label>
                  <input className="input" style={{ minHeight: 44 }} id="enquiry-mobile" name="mobile" type="tel" placeholder="+91 98480 00000" required />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="enquiry-location">Where is the plot?</label>
                  <input className="input" style={{ minHeight: 44 }} id="enquiry-location" name="plot_location" placeholder="Village or mandal — approximate is fine" />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label htmlFor="enquiry-notes">
                    Anything we should know <span className="text-muted">(optional)</span>
                  </label>
                  <textarea className="input" style={{ minHeight: 84, resize: 'none', lineHeight: 1.5 }} id="enquiry-notes" name="notes" placeholder="Survey number, a concern, a deadline" />
                </div>
                {error && <p style={{ color: 'var(--p-alert)', fontSize: 13, marginTop: 10 }}>{error}</p>}
                <button type="submit" className="btn btn-primary btn-block" style={{ minHeight: 48, fontSize: 14, marginTop: 16 }} disabled={isPending}>
                  {isPending ? 'Sending…' : 'Request a call back'}
                </button>
                <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 10, lineHeight: 1.5 }}>We use your number only to contact you about this plot.</div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer style={{ borderTop: '2px solid var(--color-divider)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 22px 34px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--p-ink-soft)', lineHeight: 1.6 }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>PLOT360</span>
            <br />
            plot360.in · {SUPPORT_EMAIL} · Hyderabad, Telangana
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {MENU.map((m) => (
              <a key={m.href} href={m.href} className="footer-link" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '6px 0', fontSize: 12.5 }}>
                {m.label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>© {new Date().getFullYear()} Plot360. Not a broker, valuer or title-verification authority.</div>
        </div>
      </footer>
    </div>
  );
}
