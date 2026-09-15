import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
