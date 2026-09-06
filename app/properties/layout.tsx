import { AppHeader } from '@/components/layout/AppHeader';

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
