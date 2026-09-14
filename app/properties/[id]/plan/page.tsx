import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveVisitPlans } from '@/components/payments/visitCredits.actions';
import { getPaymentSettings, getPaymentQrUrl } from '@/components/payments/plans.actions';
import { ChoosePlanAndPay } from '@/components/customer/ChoosePlanAndPay';

// Redesign 2026-09 — Register Step 2 (design_handoff_plot360_redesign,
// "Plot360 Customer.dc.html"), also reused whenever a customer buys more
// visit credits on an already-registered property (the Home screen and
// Property visit-history screen both link here when credits run out).
export default async function ChoosePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: property } = await supabase
    .from('properties')
    .select('id, property_name, owner_id')
    .eq('id', id)
    .single();
  if (!property || property.owner_id !== userData.user.id) redirect('/dashboard');

  const [plans, paymentSettings] = await Promise.all([getActiveVisitPlans(), getPaymentSettings()]);
  const qrUrl = paymentSettings?.qr_code_image_path ? await getPaymentQrUrl(paymentSettings.qr_code_image_path) : null;

  return (
    <main>
      <ChoosePlanAndPay
        propertyId={id}
        propertyName={property.property_name}
        plans={plans as any}
        paymentSettings={paymentSettings as any}
        qrUrl={qrUrl}
      />
    </main>
  );
}
