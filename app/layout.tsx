import '@/styles/globals.css';
// Redesign 2026-09 — Modernist design tokens for the new surfaces, scoped
// entirely under a `.p360` wrapper class so they never affect the
// pre-redesign UI (see styles/plot360-redesign.css and ARCHITECTURE.md).
import '@/styles/plot360-redesign.css';

export const metadata = {
  title: 'Plot360',
  description: 'Register, verify, and track your properties.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
