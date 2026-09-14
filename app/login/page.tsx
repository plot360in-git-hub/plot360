import { LoginForm } from '@/components/auth/LoginForm';

// New route — previously the only way to log in was the form embedded
// directly on the home page. The redesign replaces the home page with the
// marketing landing page (see components/marketing/LandingPage.tsx), so
// login needs its own place to live; this just relocates the existing,
// unmodified LoginForm rather than rebuilding it — the customer app's own
// redesigned Auth screen (tabs, social login, WhatsApp OTP) is a later
// phase (see design_handoff_plot360_redesign/README.md, "Customer app").
export default function LoginPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 60, paddingBottom: 60, display: 'flex', justifyContent: 'center' }}>
      {/* LoginForm carries its own `marginLeft: auto` (a leftover from
          sitting beside hero copy on the old home page) — the flex
          wrapper here just re-centers it now that it's alone on its own
          page, without editing the component itself. */}
      <LoginForm />
    </main>
  );
}
