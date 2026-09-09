import { getActivePlans, getPaymentSettings, getPaymentQrUrl } from '@/components/payments/plans.actions';
import { getMyPendingPaymentForProperty } from '@/components/properties/subscribe/subscribe.actions';
import { SubscribeForm } from '@/components/properties/subscribe/SubscribeForm';

export default async function SubscribePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plans, paymentSettings, pendingPayment] = await Promise.all([
    getActivePlans(),
    getPaymentSettings(),
    getMyPendingPaymentForProperty(id),
  ]);

  const qrUrl = paymentSettings?.qr_code_image_path ? await getPaymentQrUrl(paymentSettings.qr_code_image_path) : null;

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <SubscribeForm
        propertyId={id}
        plans={plans}
        paymentSettings={paymentSettings}
        qrUrl={qrUrl}
        pendingPayment={pendingPayment}
      />
    </main>
  );
}
