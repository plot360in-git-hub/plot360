import { AppHeader } from '@/components/layout/AppHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
