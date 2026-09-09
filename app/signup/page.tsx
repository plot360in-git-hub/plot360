import { SignupForm } from '@/components/auth/SignupForm';

// Raises this route's serverless function timeout past Vercel Hobby's
// 10-second default — signup now involves two sequential network calls
// (Turnstile verification + Supabase signUp, which itself waits on the
// SMTP relay to send the confirmation email), which can occasionally run
// longer than 10s, especially on a freshly-configured custom SMTP domain.
export const maxDuration = 30;

export default function SignupPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 60 }}>
      <SignupForm />
    </main>
  );
}
