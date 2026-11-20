'use server';

import { createClient } from '@/lib/supabase/server';
import { toE164, looksLikePhoneNumber } from '@/lib/phone';

// Redesign 2026-09 (follow-up, 2026-11-12) — phone verification, Plot:
// "whenever user gives mobile number and email address at the time of
// registration and if user changes their email or phone number after
// registration, the verification needs to be done... for phone a
// whatsapp message can be sent to confirm." Email already has this —
// Supabase's own confirmation-link flow fires both at signup
// (auth.actions.ts, signUp) and on change (profile.actions.ts/agent
// onboarding.actions.ts, auth.updateUser({ email })) — nothing new
// needed there. Phone had none at all.
//
// Deliberately reuses the SAME Supabase mechanism the existing
// "Continue with WhatsApp OTP" login button already depends on
// (auth.actions.ts, sendPhoneOtp/verifyPhoneOtp) rather than building a
// second, custom OTP system: a Phone provider (Twilio Verify, Message
// Channel set to WhatsApp) configured once in the Supabase dashboard.
// That makes WhatsApp delivery Supabase/Twilio's problem, not ours — no
// new `otp_codes` table, no code-generation/expiry/rate-limiting logic
// to write or get wrong here.
//
// The two calls below are the OTHER half of that same mechanism —
// changing the phone number of an ALREADY signed-in user (type:
// 'phone_change') rather than signing in with one (type: 'sms', what
// sendPhoneOtp/verifyPhoneOtp do). Exactly parallel to how
// updateMyProfile already calls auth.updateUser({ email }) for an email
// change while staying signed in. auth.users.phone / phone_confirmed_at
// (Supabase's own built-in columns — no schema change needed) become the
// one source of truth for "is this phone verified"; callers
// (saveCustomerRegistration, updateMyProfile) check those two fields
// themselves before ever writing profiles.phone_number, so a verified
// number can't be bypassed by calling the save action directly.
export async function sendPhoneVerificationCode(countryCode: string, number: string) {
  if (!countryCode.trim() || !looksLikePhoneNumber(number)) {
    return { error: 'Enter a valid phone number.' };
  }
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const e164 = toE164(countryCode, number);
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) return { error: error.message };
  return { success: true as const };
}

export async function confirmPhoneVerificationCode(countryCode: string, number: string, token: string) {
  const code = token.trim();
  if (!code) return { error: 'Enter the code sent to your WhatsApp.' };

  const supabase = await createClient();
  const e164 = toE164(countryCode, number);
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
  if (error) return { error: error.message };
  if (!data.user) return { error: 'Verification failed — please try again.' };
  return { success: true as const };
}
