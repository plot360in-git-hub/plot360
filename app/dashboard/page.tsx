import { getCustomerHomeData, maskPhone } from '@/components/customer/home.data';
import { CustomerHome } from '@/components/customer/CustomerHome';

// Redesign 2026-09 — swapped to the new poster-header Home screen
// (design_handoff_plot360_redesign, "Plot360 Customer.dc.html"). The old
// CustomerDashboard.tsx is kept intact but no longer wired in here — see
// ARCHITECTURE.md, "Redesign 2026-09 — customer app".
export default async function DashboardPage() {
  const data = await getCustomerHomeData();
  if (!data) return <p>Please sign in.</p>;

  return (
    <CustomerHome
      firstName={data.profile?.first_name ?? ''}
      maskedPhone={maskPhone(data.profile?.phone_number)}
      properties={data.properties as any}
      creditsByProperty={data.creditsByProperty}
      reservedByProperty={data.reservedByProperty}
      jobsByProperty={data.jobsByProperty}
      openRequestCountByProperty={data.openRequestCountByProperty}
      pendingPaymentByProperty={data.pendingPaymentByProperty}
      photoUrlByProperty={data.photoUrlByProperty}
    />
  );
}
