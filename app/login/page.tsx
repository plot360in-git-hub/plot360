import { AuthScreen } from '@/components/auth/AuthScreen';

// Redesign 2026-09 (follow-up) — was rendering the old, unmodified
// LoginForm (see the removed comment below this one for why); that was
// meant to be a temporary stand-in for a later phase and was never
// actually replaced or flagged as left undone. Now renders the real
// design_handoff_plot360_redesign "Log in / sign up" screen. LoginForm.tsx
// itself is untouched and still exists, just no longer wired to a route.
export default function LoginPage() {
  return <AuthScreen initialTab="login" />;
}
