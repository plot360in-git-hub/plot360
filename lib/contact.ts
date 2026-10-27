// Shared contact details for the redesign (design_handoff_plot360_redesign/
// README.md, "Placeholders to replace") — pulled out of
// components/marketing/LandingPage.tsx so every redesigned screen
// (customer app, confirmation messages, the visit report PDF, etc.) uses
// the same values instead of redefining them per-component.
// Real support number as of 2026-09-20 (was a placeholder before this).
export const WHATSAPP_DIGITS = '919573290679';
export const WA_LINK = `https://wa.me/${WHATSAPP_DIGITS}`;
export const TEL_LINK = 'tel:+919573290679';
export const DISPLAY_PHONE = '+91 95732 90679';
// Redesign 2026-09 (follow-up, 2026-10-27) — Plot: real support inbox,
// replacing the support@plot360.in placeholder. Changed here (the one
// shared constant — see this file's header comment) so the landing
// page's Contact section/footer and the visit report PDF all pick it
// up together.
export const SUPPORT_EMAIL = 'plot360.in@gmail.com';

// Redesign 2026-09 (follow-up, 2026-10-27) — Plot: the registered
// business entity behind Plot360, for the landing page's Contact
// section. COMPANY_ADDRESS_LINES is an array (rather than one string)
// so the Contact section can render it as a proper multi-line address
// block instead of one run-on sentence.
export const COMPANY_NAME = 'NSR VENTURES LLP';
export const COMPANY_ADDRESS_LINES = [
  'House No 1-100/ACL/F/1406, APARNA CYBERLIFE APT,',
  'Lingampalli, CHANDA NAGAR, Serilingampally,',
  'K.V.Rangareddy- 500019, Telangana, India',
];

// The design mock's confirmation messages name a specific representative
// ("Rajesh will contact you…") — also a placeholder until there's a real
// assignment/routing rule for who follows up.
export const REPRESENTATIVE_NAME = 'Rajesh';

export function waLinkWithText(text: string): string {
  return `${WA_LINK}?text=${encodeURIComponent(text)}`;
}
