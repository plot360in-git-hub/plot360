// A profile's first_name/last_name can be blank if the customer registered
// but never completed the Customer Registration (KYC) form — the signup
// trigger only creates a stub row. Falls back through name -> username -> email
// so the admin UI never shows a blank "Submitted by ()".
export function profileDisplayName(profile?: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
} | null) {
  if (!profile) return 'Unknown user';
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (profile.username) return profile.username;
  if (profile.email) return profile.email;
  return 'Unknown user';
}
