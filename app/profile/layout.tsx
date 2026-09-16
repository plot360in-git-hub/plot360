// Redesign 2026-09 (follow-up, round 11) — ProfileEditForm now renders its
// own back-button header (← Edit profile), the same pattern used by every
// other standalone redesigned screen (ScheduleVisit, ChoosePlanAndPay,
// RegisterQuick) rather than the full CustomerHeader nav bar.
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
