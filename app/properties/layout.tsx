import { CustomerHeader } from '@/components/layout/CustomerHeader';

export default function PropertiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomerHeader />
      {children}
    </>
  );
}
