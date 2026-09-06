import { createBrowserClient } from '@supabase/ssr';

// Used inside 'use client' components. Reads the public anon key —
// row-level security (see supabase/schema.sql) is what actually keeps
// each user's data private, not this key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
