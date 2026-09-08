import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Supabase's email confirmation link points here with a one-time `code`
// query param. This route exchanges that code for a real logged-in
// session, then sends a freshly-confirmed customer straight into KYC
// onboarding (the next step in the signup flow) rather than dumping them
// on the dashboard with a still-incomplete profile.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  // Invalid, expired, or already-used code — send back to the homepage
  // with a flag rather than showing a raw 404.
  return NextResponse.redirect(`${origin}/?confirm=failed`);
}
