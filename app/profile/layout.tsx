import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
