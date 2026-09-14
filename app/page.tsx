import { LandingPage } from '@/components/marketing/LandingPage';

// Redesign 2026-09 — replaces the previous marketing home page with the
// design handoff's landing page (design/Plot360 Landing.dc.html). The old
// page's `?confirm=failed` banner was dead code — nothing in the app ever
// set that query param; app/auth/callback/page.tsx shows its own inline
// failure state instead — so nothing is lost by not carrying it over.
//
// The one thing the old page did that had to go somewhere: its embedded
// LoginForm now lives at /login (see app/login/page.tsx) since the
// landing page's "Log in" links need a real destination and there was no
// standalone login route before this.
export const metadata = {
  title: 'Plot360 — Site visits across Ranga Reddy & Hyderabad',
  description:
    "A verified Plot360 agent visits your plot, photographs every boundary and answers ten fixed checks — so you don't have to travel to check on your land.",
};

export default function HomePage() {
  return <LandingPage />;
}
