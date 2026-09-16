// Redesign 2026-09 (follow-up, round 10) — this used to always render the
// full CustomerHeader (Dashboard / Add Property / Service Requests nav)
// above the onboarding form, which is wrong for a brand-new account: none
// of those pages make sense before the profile is even filled in, and
// navigating away here leaves the account permanently stuck being routed
// back to /onboarding on every login (see app/auth/callback/page.tsx —
// it checks profiles.first_name). The rebuilt CustomerRegistrationForm
// renders its own minimal PLOT360 header instead, matching how other
// standalone customer flows (ScheduleVisit, ChoosePlanAndPay) handle
// their own header rather than relying on a shared nav.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
