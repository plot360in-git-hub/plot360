import { AppHeader } from '@/components/layout/AppHeader';

export default function ServiceRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
