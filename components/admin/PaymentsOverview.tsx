import {
  getPendingPayments,
  getCompletedPayments,
  getUpcomingRenewalsDue,
  getPaymentProofUrl,
} from '@/components/payments/payments.actions';
import { profileDisplayName } from './displayName';
import { PaymentRecordForm } from './PaymentRecordForm';
import Link from 'next/link';

const TYPE_LABEL: Record<string, string> = { initial: 'Initial registration', renewal: 'Renewal' };

export async function PaymentsOverview() {
  const [pending, completed, upcoming] = await Promise.all([
    getPendingPayments(),
    getCompletedPayments(),
    getUpcomingRenewalsDue(30),
  ]);

  const screenshotUrls: Record<string, string | null> = {};
  for (const p of pending) {
    if (p.screenshot_path) screenshotUrls[p.screenshot_path] = await getPaymentProofUrl(p.screenshot_path);
  }

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 32 }}>Payments</h1>

      <h3 style={{ marginBottom: 4 }}>Pending payments</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
        {pending.length} awaiting confirmation
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
        {pending.map((p: any) => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>{p.properties?.property_name}</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                  {TYPE_LABEL[p.payment_type] ?? p.payment_type} · {profileDisplayName(p.properties?.profiles)} ·{' '}
                  {p.properties?.profiles?.email}
                </p>
              </div>
              <Link href={`/admin/${p.properties?.id}`} style={{ color: 'var(--color-link)', fontSize: 14, whiteSpace: 'nowrap' }}>
                View property
              </Link>
            </div>

            <div className="card section-alt" style={{ marginBottom: 12 }}>
              <p className="field-label" style={{ marginBottom: 8 }}>Customer-submitted proof</p>
              {p.subscription_plans || p.transaction_reference ? (
                <>
                  {p.subscription_plans && (
                    <p style={{ fontSize: 14, marginBottom: 4 }}>
                      Plan: {p.subscription_plans.name} — ₹{p.subscription_plans.price} ({p.subscription_plans.validity_months} months)
                    </p>
                  )}
                  {p.payment_method && <p style={{ fontSize: 14, marginBottom: 4 }}>Method: {p.payment_method}</p>}
                  {p.transaction_reference && <p style={{ fontSize: 14, marginBottom: 4 }}>Transaction ID: {p.transaction_reference}</p>}
                  {p.screenshot_path && screenshotUrls[p.screenshot_path] ? (
                    <a href={screenshotUrls[p.screenshot_path]!} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)', fontSize: 14 }}>
                      View screenshot
                    </a>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No screenshot uploaded.</p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                  Customer hasn't submitted payment proof yet — nothing to review.
                </p>
              )}
            </div>

            <PaymentRecordForm
              paymentId={p.id}
              propertyId={p.properties?.id}
              defaultAmount={p.amount ?? p.subscription_plans?.price}
              defaultMethod={p.payment_method}
              defaultReference={p.transaction_reference}
            />
          </div>
        ))}
        {pending.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No payments waiting on confirmation.</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Renewals due soon</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
        Completed payments expiring within 30 days — good candidates for a reminder
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {upcoming.map((p: any) => (
          <div key={p.id} className="card section-alt" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>{p.properties?.property_name}</strong>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                {' — '}{profileDisplayName(p.properties?.profiles)} · {p.properties?.profiles?.email}
                {p.properties?.profiles?.phone_number && ` · ${p.properties.profiles.phone_country_code ?? ''} ${p.properties.profiles.phone_number}`}
              </span>
            </div>
            <span className="status-pill pending">Expires {p.valid_until}</span>
          </div>
        ))}
        {upcoming.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing expiring in the next 30 days.</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Payment history</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>All completed payments</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 14 }}>
            <th style={{ padding: '8px 0' }}>Property</th>
            <th>Type</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Paid</th>
            <th>Valid until</th>
          </tr>
        </thead>
        <tbody>
          {completed.map((p: any) => (
            <tr key={p.id} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0' }}>{p.properties?.property_name}</td>
              <td>{TYPE_LABEL[p.payment_type] ?? p.payment_type}</td>
              <td>{p.payment_method}</td>
              <td>{p.transaction_reference || '—'}</td>
              <td>{p.paid_at}</td>
              <td>{p.valid_until}</td>
            </tr>
          ))}
          {completed.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '20px 0', color: 'var(--color-text-muted)' }}>No completed payments yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
