import { AppHeader } from '@/components/layout/AppHeader';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
