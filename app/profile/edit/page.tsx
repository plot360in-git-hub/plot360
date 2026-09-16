import { redirect } from 'next/navigation';
import { getMyProfile } from '@/components/profile/profile.actions';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';

// Redesign 2026-09 (follow-up, round 11) — ProfileEditForm is now a
// self-contained .p360 screen (own back-button header, own max-width),
// same as every other rebuilt customer screen, so this page just renders
// it — no more `container-narrow` wrapper from the old design system.
export default async function ProfileEditPage() {
  const result = await getMyProfile();
  if (!result) redirect('/');
  return <ProfileEditForm profile={result.profile} hasPassword={result.hasPassword} />;
}
