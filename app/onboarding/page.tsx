import { CustomerRegistrationForm } from '@/components/onboarding/CustomerRegistrationForm';
import { createClient } from '@/lib/supabase/server';

// Redesign 2026-09 (follow-up, round 10) — the old wrapper's
// `container-narrow` class and fixed top/bottom padding belonged to the
// pre-redesign design system; CustomerRegistrationForm is now a
// self-contained .p360 screen (own header, own max-width, own padding),
// same as every other rebuilt customer screen, so this page just renders it.
//
// Redesign 2026-09 (follow-up, 2026-11-12) — phone verification. Someone
// who signed up via "Continue with WhatsApp OTP" (AuthScreen.tsx) already
// has a verified auth.users.phone/phone_confirmed_at the moment they land
// here — that signup WAS a verified-phone signup. Passing it down as
// initialPhoneVerifiedE164 lets PhoneVerifyPanel recognize "the number
// you just typed is the one already verified on this account" and skip
// asking for a second code; everyone else (email/password or Google
// signup) just sees the normal "Verify this number via WhatsApp" step.
// Not attempting to split auth.users.phone (a single E.164 string) back
// into the form's separate country-code + number fields to pre-fill them
// — there's no reliable way to do that for every country (variable-
// length dial codes) — so that signed-in user just re-types the number
// they already verified, same as they typed it a minute earlier.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const verifiedE164 = userData.user?.phone_confirmed_at ? (userData.user.phone ?? null) : null;

  return <CustomerRegistrationForm initialPhoneVerifiedE164={verifiedE164} />;
}
