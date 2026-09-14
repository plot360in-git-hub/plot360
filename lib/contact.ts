// Shared contact placeholders for the redesign (design_handoff_plot360_redesign/
// README.md, "Placeholders to replace") — swap these before launch. Pulled
// out of components/marketing/LandingPage.tsx so every new redesigned
// screen (customer app, confirmation messages, etc.) uses the same values
// instead of redefining them per-component.
export const WHATSAPP_DIGITS = '919000036000';
export const WA_LINK = `https://wa.me/${WHATSAPP_DIGITS}`;
export const TEL_LINK = 'tel:+919000036000';
export const DISPLAY_PHONE = '+91 90000 36000';
export const SUPPORT_EMAIL = 'support@plot360.in';

// The design mock's confirmation messages name a specific representative
// ("Rajesh will contact you…") — also a placeholder until there's a real
// assignment/routing rule for who follows up.
export const REPRESENTATIVE_NAME = 'Rajesh';

export function waLinkWithText(text: string): string {
  return `${WA_LINK}?text=${encodeURIComponent(text)}`;
}
