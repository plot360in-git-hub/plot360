import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const CUSTOMER_PREFIXES = ['/dashboard', '/properties', '/tasks', '/onboarding', '/profile', '/service-requests'];
const AGENT_PREFIXES = ['/agent/dashboard', '/agent/jobs', '/agent/profile'];

// Runs before any protected page renders. Three zones, each locked to the
// right account type:
//  - /admin/*            -> must be logged in AND is_admin
//  - customer pages       -> must be logged in AND NOT is_agent (agents use their own dashboard)
//  - /agent/dashboard,/agent/jobs -> must be logged in AND is_agent
// Page-level guards in each route stay in place as defense in depth.
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: userData } = await supabase.auth.getUser();
  const isAdminZone = path.startsWith('/admin');
  const isAgentZone = AGENT_PREFIXES.some((p) => path.startsWith(p));
  const isCustomerZone = CUSTOMER_PREFIXES.some((p) => path.startsWith(p));

  if (!userData.user) {
    if (isAdminZone) return NextResponse.redirect(new URL('/admin/login', request.url));
    if (isAgentZone) return NextResponse.redirect(new URL('/agent/login', request.url));
    return NextResponse.redirect(new URL('/', request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, is_agent')
    .eq('id', userData.user.id)
    .single();

  if (isAdminZone && !profile?.is_admin) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isAgentZone && !profile?.is_agent) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isCustomerZone && profile?.is_agent) {
    return NextResponse.redirect(new URL('/agent/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/((?!login).*)',
    '/dashboard/:path*',
    '/properties/:path*',
    '/tasks/:path*',
    '/onboarding/:path*',
    '/profile/:path*',
    '/service-requests/:path*',
    '/agent/dashboard/:path*',
    '/agent/jobs/:path*',
    '/agent/profile/:path*',
  ],
};
