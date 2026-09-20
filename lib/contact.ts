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
export const SUPPORT_EMAIL = 'support@plot360.in';

// The design mock's confirmation messages name a specific representative
// ("Rajesh will contact you…") — also a placeholder until there's a real
// assignment/routing rule for who follows up.
export const REPRESENTATIVE_NAME = 'Rajesh';

export function waLinkWithText(text: string): string {
  return `${WA_LINK}?text=${encodeURIComponent(text)}`;
}
