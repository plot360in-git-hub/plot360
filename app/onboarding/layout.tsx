import { AppHeader } from '@/components/layout/AppHeader';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
