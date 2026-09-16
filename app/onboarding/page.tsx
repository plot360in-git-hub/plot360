import { CustomerRegistrationForm } from '@/components/onboarding/CustomerRegistrationForm';

// Redesign 2026-09 (follow-up, round 10) — the old wrapper's
// `container-narrow` class and fixed top/bottom padding belonged to the
// pre-redesign design system; CustomerRegistrationForm is now a
// self-contained .p360 screen (own header, own max-width, own padding),
// same as every other rebuilt customer screen, so this page just renders it.
export default function OnboardingPage() {
  return <CustomerRegistrationForm />;
}
