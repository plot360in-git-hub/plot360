import { getPaymentsLedger, getAgentPayoutSummary } from './accounting.actions';
import { AccountingTabs } from './AccountingTabs';

// Redesign 2026-09 (round 32) — admin console, new Accounting screen.
// Owner role only — gated server-side by app/admin/accounting/page.tsx,
// same as Plans & pricing and Users. Two tabs per Plot's chosen design
// ("One combined Accounting section"): Payments received (every
// payment, either method, any status — for tallying real money in
// against properties) and Agent payouts (what's owed/paid to agents
// for their completed visits, bookkeeping only — see
// components/admin/accounting.actions.ts for why).
export async function AccountingPage() {
  const [ledger, payouts] = await Promise.all([getPaymentsLedger(), getAgentPayoutSummary()]);

  return (
    <div style={{ padding: '22px 26px 30px' }}>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Accounting</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
        Owner role only. Tally every payment received against properties, and track what's owed and paid to agents for
        their completed visits.
      </div>

      <AccountingTabs ledger={ledger} payouts={payouts} />
    </div>
  );
}
