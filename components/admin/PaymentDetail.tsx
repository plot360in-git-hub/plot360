import Link from 'next/link';
import { getPaymentDetail } from '@/components/payments/payments.actions';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait } from '@/lib/adminQueue';
import { PaymentDetailActions } from './PaymentDetailActions';

// Redesign 2026-09 — admin console, Payment detail screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). New route
// (/admin/payments/[id]) — the old flat /admin/payments index
// (PaymentsOverview.tsx) is kept intact and reachable, just no longer
// linked from the nav (replaced by /admin/queue/payments).
export async function PaymentDetail({ paymentId }: { paymentId: string }) {
  const payment = await getPaymentDetail(paymentId);
  if (!payment) return <p style={{ padding: 24 }}>Payment not found.</p>;

  const property: any = payment.properties;
  const customer: any = property?.profiles;
  const plan: any = payment.subscription_plans;
  const waitHours = hoursSince(payment.created_at);

  return (
    <div style={{ padding: '22px 26px 30px', maxWidth: 700 }}>
      <Link href="/admin/queue/payments" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
        ← Back to queue
      </Link>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>Bank transfer · {property?.property_name ?? 'Property'}</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
        {profileDisplayName(customer)} · submitted {payment.created_at?.slice(0, 10)} · waiting {formatWait(waitHours)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', marginTop: 18, fontSize: 12.5, borderTop: '2px solid var(--color-divider)' }}>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>Plan</div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
          {plan ? `${plan.name} · ₹${Number(plan.price ?? 0).toLocaleString('en-IN')}` : '—'}
        </div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>Amount claimed</div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
          {payment.amount ? `₹${Number(payment.amount).toLocaleString('en-IN')}` : '—'}
        </div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>Reference</div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{payment.transaction_reference || 'Not provided yet'}</div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>Credits on confirm</div>
        <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
          {plan?.visit_quantity ? `${plan.visit_quantity} visit${plan.visit_quantity > 1 ? 's' : ''}` : '1 year validity extension'}
        </div>
        {payment.mismatch_reason && (
          <>
            <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-alert)' }}>Flagged</div>
            <div style={{ padding: '9px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600, color: 'var(--p-alert)' }}>{payment.mismatch_reason}</div>
          </>
        )}
      </div>

      <PaymentDetailActions paymentId={paymentId} propertyId={property?.id} defaultAmount={payment.amount ?? plan?.price} defaultReference={payment.transaction_reference} />
    </div>
  );
}
