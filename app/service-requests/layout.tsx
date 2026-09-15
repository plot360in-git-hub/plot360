import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function ServiceRequestsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
