import { getAllPlans } from '@/components/payments/plans.actions';
import { getPaymentSettings, getPaymentQrUrl } from '@/components/payments/plans.actions';
import { PlansTable } from './PlansTable';
import { PaymentSettingsForm } from './PaymentSettingsForm';

// Redesign 2026-09 — admin console, Plans & pricing screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). Owner
// role only — gated server-side by app/admin/plans/page.tsx. Replaces
// PlansSettingsPage.tsx (kept intact, unreferenced — see ARCHITECTURE.md)
// with the Modernist look and the design's editable-row pattern; reuses
// the same, untouched actions (getAllPlans, upsertPlan, getPaymentSettings,
// updatePaymentSettings).
export async function PlansPricingPage() {
  const [plans, settings] = await Promise.all([getAllPlans(), getPaymentSettings()]);
  const qrUrl = settings?.qr_code_image_path ? await getPaymentQrUrl(settings.qr_code_image_path) : null;

  return (
    <div style={{ padding: '22px 26px 30px' }}>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Plans and payment settings</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>Owner role only. Prices here are what customers see at registration.</div>

      <PlansTable plans={plans as any[]} />
      <PaymentSettingsForm settings={settings} qrUrl={qrUrl} />
    </div>
  );
}
