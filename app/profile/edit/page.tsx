import { redirect } from 'next/navigation';
import { getMyProfile } from '@/components/profile/profile.actions';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';

export default async function ProfileEditPage() {
  const profile = await getMyProfile();
  if (!profile) redirect('/');
  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <ProfileEditForm profile={profile} />
    </main>
  );
}
