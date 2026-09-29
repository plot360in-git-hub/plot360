import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Android app (TWA) entry point — the app's launcher URL is
// https://plot360.in/app-launch. Sends a signed-in customer straight to
// their dashboard, anyone else to the login screen (skipping the
// marketing landing page). Agent accounts go to /app-only, since the
// Android app is customer-only. `?source=app` is what the in-page guard
// in app/layout.tsx uses to switch the tab into customer-only "app mode".
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  let target = '/login';
  if (data.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_agent')
      .eq('id', data.user.id)
      .single();
    target = profile?.is_agent ? '/app-only' : '/dashboard';
  }

  return NextResponse.redirect(new URL(`${target}?source=app`, request.url));
}
