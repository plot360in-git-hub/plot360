import '@/styles/globals.css';
// Redesign 2026-09 — Modernist design tokens for the new surfaces, scoped
// entirely under a `.p360` wrapper class so they never affect the
// pre-redesign UI (see styles/plot360-redesign.css and ARCHITECTURE.md).
import '@/styles/plot360-redesign.css';
import { Archivo } from 'next/font/google';

// Redesign 2026-09 (round 33) — "Implementation Change List" item 4:
// Archivo was only ever loaded inside components/marketing/LandingPage.tsx
// (a client component), so every OTHER `.p360` screen — including
// CustomerHeader.tsx and CustomerHome.tsx, the two most-used customer
// screens — silently fell back to system-ui, since `--p360-font-archivo`
// (the CSS variable `--font-heading`/`--font-body` in
// plot360-redesign.css actually reads) was never set outside the landing
// page's own subtree. Loading it once here, on the root layout, makes it
// available everywhere `.p360` is used. Same config as before (just
// relocated) — see LandingPage.tsx for where this used to live.
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--p360-font-archivo',
  display: 'swap',
});

export const metadata = {
  title: 'Plot360',
  description: 'Register, verify, and track your properties.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
