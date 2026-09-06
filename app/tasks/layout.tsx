import { AppHeader } from '@/components/layout/AppHeader';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
