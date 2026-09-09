import { redirect } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { getAllPlans, getPaymentSettings, getPaymentQrUrl } from '@/components/payments/plans.actions';
import { PlansSettingsPage } from '@/components/payments/PlansSettingsPage';

export default async function AdminPlansPage() {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const [plans, paymentSettings] = await Promise.all([getAllPlans(), getPaymentSettings()]);
  const qrUrl = paymentSettings?.qr_code_image_path ? await getPaymentQrUrl(paymentSettings.qr_code_image_path) : null;

  return <PlansSettingsPage plans={plans} paymentSettings={paymentSettings} qrUrl={qrUrl} />;
}
