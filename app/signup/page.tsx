import { AuthScreen } from '@/components/auth/AuthScreen';

// Redesign 2026-09 (follow-up) — see app/login/page.tsx for context. Same
// AuthScreen, opened on the Sign up tab; SignupForm.tsx is untouched and
// still exists, just no longer wired to a route.
//
// Raises this route's serverless function timeout past Vercel Hobby's
// 10-second default — signup now involves two sequential network calls
// (Turnstile verification + Supabase signUp, which itself waits on the
// SMTP relay to send the confirmation email), which can occasionally run
// longer than 10s, especially on a freshly-configured custom SMTP domain.
export const maxDuration = 30;

export default function SignupPage() {
  return <AuthScreen initialTab="signup" />;
}
