import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

// Redesign 2026-09 (round 36) — dropped the legacy `container-narrow`
// wrapper (styles/globals.css) now that AdminLoginForm.tsx supplies its
// own full-width `.p360` layout — same as app/agent/login/page.tsx's
// bare `<main>`, kept only so this route has a landmark element.
export default function AdminLoginPage() {
  return (
    <main>
      <AdminLoginForm />
    </main>
  );
}
