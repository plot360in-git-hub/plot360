import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Used ONLY by the public /m/[token] magic-link flow. An anonymous visitor
// holding just a token has no Supabase session, so normal RLS-based auth
// (auth.uid()) can't apply — this client bypasses RLS entirely using the
// service_role secret key. Every function that uses this MUST validate the
// token (existence, expiry, job status) itself before touching any data,
// since there's no RLS safety net once this client is used.
//
// SECURITY_ROLE_KEY must never be prefixed with NEXT_PUBLIC_ and must never
// be sent to the browser — it only ever runs inside server actions.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase dashboard → Project Settings → API → service_role secret key). Never expose this key to the browser.'
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
