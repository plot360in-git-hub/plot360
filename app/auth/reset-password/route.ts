import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// The password-reset email links here with a one-time `code`. This MUST
// be a Route Handler, not a page.tsx (Server Component) — Server
// Components cannot write response cookies in Next.js, so exchanging the
// code there would appear to succeed but silently fail to persist the
// session, breaking the update-password step right after. Route Handlers
// can write cookies correctly, which is the whole reason this exists as
// its own route rather than living directly on the page that shows the form.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/auth/update-password`);
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=expired`);
}
