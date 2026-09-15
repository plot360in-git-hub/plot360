import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
