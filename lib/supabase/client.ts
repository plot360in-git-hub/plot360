import { createBrowserClient } from '@supabase/ssr';

// Used inside 'use client' components. Reads the public anon key —
// row-level security (see supabase/schema.sql) is what actually keeps
// each user's data private, not this key.
//
// flowType: 'implicit' — PKCE (the default) requires the SAME browser
// that submitted signup/reset-password to also be the one that opens the
// confirmation link, since it depends on a locally-stored verifier
// cookie. That's a real risk for actual users too (sign up on desktop,
// check email on phone) not just a testing quirk — implicit flow embeds
// the session directly in the link instead, so it works from any device.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  );
}
