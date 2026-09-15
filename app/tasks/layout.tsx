import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
