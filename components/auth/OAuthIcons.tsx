// Redesign 2026-09 (round 37) — Plot asked for the "Continue with
// Google/Facebook/WhatsApp" buttons to carry the providers' own marks,
// the way most sign-in screens do, rather than plain text. Shared here
// since the same three buttons appear in three places (customer
// AuthScreen.tsx, AgentLoginForm.tsx, AgentSignupForm.tsx) — one set of
// icons kept in sync rather than three copies. Standard, full-color
// brand marks (not recolored to the app's Deep Navy accent) — these are
// third-party logos, not this app's own UI chrome, so they stay exactly
// as each provider's own brand guidelines specify.
export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <path
        fill="#1877F2"
        d="M48 24C48 10.7 37.3 0 24 0S0 10.7 0 24c0 12 8.8 22 20.25 23.8V30.9h-6.1V24h6.1v-5.3c0-6 3.6-9.3 9-9.3 2.6 0 5.3.5 5.3.5v5.9h-3c-3 0-3.9 1.9-3.9 3.7V24h6.6l-1.1 6.9h-5.5v16.9C39.2 46 48 36 48 24z"
      />
    </svg>
  );
}

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <path fill="#25D366" d="M24 0C10.7 0 0 10.7 0 24c0 4.2 1.1 8.3 3.2 11.9L0 48l12.4-3.2C16 46.8 20 48 24 48c13.3 0 24-10.7 24-24S37.3 0 24 0z" />
      <path
        fill="#FFF"
        d="M35.2 28.4c-.6-.3-3.5-1.7-4-1.9-.5-.2-.9-.3-1.3.3-.4.6-1.5 1.9-1.8 2.3-.3.4-.7.4-1.3.1-.6-.3-2.5-.9-4.7-2.9-1.7-1.5-2.9-3.4-3.2-4-.3-.6 0-.9.3-1.2.3-.3.6-.7.9-1 .3-.3.4-.6.6-1 .2-.4.1-.7 0-1-.1-.3-1.3-3.1-1.8-4.3-.5-1.1-1-1-1.3-1-.3 0-.7 0-1.1 0-.4 0-1 .1-1.5.7-.5.6-2 2-2 4.8 0 2.8 2 5.6 2.3 6 .3.4 4 6.1 9.7 8.5 1.4.6 2.4.9 3.3 1.2 1.4.4 2.6.4 3.6.2 1.1-.2 3.5-1.4 4-2.8.5-1.4.5-2.5.3-2.8-.2-.3-.6-.4-1.2-.7z"
      />
    </svg>
  );
}
