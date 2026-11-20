// Redesign 2026-09 (follow-up, 2026-11-12) — phone verification. One
// shared place to turn the app's split { phone_country_code, phone_number }
// fields (e.g. "+91" + "98480 00000") into the single E.164 string
// Supabase's phone auth (auth.updateUser({ phone }) / auth.verifyOtp)
// requires (e.g. "+919848000000") — no spaces, no formatting, country
// code and number run together. COUNTRY_CODES (lib/countryCodes.ts)
// already stores each dial code with its leading "+", so this just strips
// anything non-digit out of the number and concatenates.
export function toE164(countryCode: string, number: string): string {
  const dial = (countryCode || '').trim();
  const digits = (number || '').replace(/\D/g, '');
  return `${dial}${digits}`;
}

// Loose sanity check before even asking Supabase/Twilio to send a code —
// catches an obviously-empty or truncated number client- and server-side
// without trying to replicate real phone-number validation (Twilio/
// Supabase will reject anything this lets through that still isn't real).
export function looksLikePhoneNumber(number: string): boolean {
  const digits = (number || '').replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 14;
}

// Digits-only comparison between two E.164-ish strings — used everywhere
// this file's toE164() output gets compared against auth.users.phone.
// Supabase/GoTrue has stored that column with or without a leading "+"
// across different versions, and we'd rather not bet the entire
// registration/profile-save gate on guessing right; stripping every
// non-digit from both sides before comparing makes the check correct
// either way.
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a || '').replace(/\D/g, '');
  const db = (b || '').replace(/\D/g, '');
  return da.length > 0 && da === db;
}
