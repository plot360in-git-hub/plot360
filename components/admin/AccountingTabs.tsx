'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { recordAgentPayout, recordAgentPayoutBulk } from './accounting.actions';

type LedgerRow = {
  id: string;
  createdAt: string;
  paidAt: string | null;
  propertyId: string | null;
  propertyName: string;
  customerName: string;
  customerEmail: string | null;
  paymentType: string | null;
  status: string;
  method: string | null;
  amount: number | null;
  reference: string | null;
  mismatchReason: string | null;
  planName: string | null;
};

type UnpaidJob = { jobId: string; propertyName: string; visitNumber: number | null; decidedAt: string | null };

type AgentRow = {
  agentId: string;
  name: string;
  email: string | null;
  approvedVisits: number;
  unpaidJobs: UnpaidJob[];
  unpaidCount: number;
  paidTotal: number;
  owed: number | null;
};

const STATUS_LABEL: Record<string, string> = { completed: 'Completed', pending: 'Pending' };

function money(n: number | null | undefined) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}

export function AccountingTabs({
  ledger,
  payouts,
}: {
  ledger: { rows: LedgerRow[]; totals: { completed: number; pending: number } };
  payouts: { agents: AgentRow[]; rate: number | null };
}) {
  const [tab, setTab] = useState<'ledger' | 'payouts'>('ledger');

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid var(--color-divider)' }}>
        {(
          [
            ['ledger', 'Payments received'],
            ['payouts', 'Agent payouts'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              fontFamily: 'inherit',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 4px',
              marginBottom: -2,
              fontSize: 13.5,
              fontWeight: tab === id ? 700 : 500,
              color: tab === id ? 'var(--color-text)' : 'var(--p-ink-soft)',
              borderBottom: tab === id ? '2px solid var(--color-accent)' : '2px solid transparent',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ledger' ? <LedgerTab ledger={ledger} /> : <PayoutsTab payouts={payouts} />}
    </div>
  );
}

function LedgerTab({ ledger }: { ledger: { rows: LedgerRow[]; totals: { completed: number; pending: number } } }) {
  const net = ledger.totals.completed - ledger.totals.pending;
  return (
    <div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '18px 0 20px' }}>
        <Stat label="Received (completed)" value={money(ledger.totals.completed)} />
        <Stat label="Awaiting confirmation" value={money(ledger.totals.pending)} muted />
        <Stat label="Net received" value={money(net)} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Property', 'Customer', 'Type', 'Method', 'Status', 'Amount', 'Reference / paid'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px 8px 0',
                    borderBottom: '2px solid var(--color-divider)',
                    fontSize: 9.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '9px 10px 9px 0', borderBottom: '1px solid var(--color-divider)' }}>
                  {r.propertyId ? (
                    <Link href={`/admin/${r.propertyId}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                      {r.propertyName}
                    </Link>
                  ) : (
                    r.propertyName
                  )}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>
                  <div>{r.customerName}</div>
                  {r.customerEmail && <div style={{ fontSize: 11, color: 'var(--p-ink-soft)' }}>{r.customerEmail}</div>}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)', textTransform: 'capitalize' }}>
                  {r.paymentType ?? '—'}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{r.method ?? '—'}</td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>
                  <span
                    className={r.status === 'completed' ? 'tag tag-accent' : 'tag'}
                    style={r.status !== 'completed' ? { background: 'rgba(220,38,38,.08)', color: 'var(--p-alert)' } : undefined}
                  >
                    {r.mismatchReason ? 'Mismatch flagged' : STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
                  {r.amount != null ? money(r.amount) : '—'}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)', fontSize: 11.5, color: 'var(--p-ink-soft)' }}>
                  {r.reference || (r.paidAt ? `Paid ${r.paidAt}` : '—')}
                </td>
              </tr>
            ))}
            {ledger.rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '20px 0', color: 'var(--p-ink-soft)' }}>
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-soft)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: muted ? 'var(--p-ink-soft)' : 'var(--color-text)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function PayoutsTab({ payouts }: { payouts: { agents: AgentRow[]; rate: number | null } }) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const totalOwed = payouts.agents.reduce((sum, a) => sum + (a.owed ?? 0), 0);
  const totalPaid = payouts.agents.reduce((sum, a) => sum + a.paidTotal, 0);

  return (
    <div>
      {payouts.rate == null && (
        <div style={{ border: '1px solid var(--color-divider)', background: 'var(--p-tint)', padding: '10px 14px', margin: '18px 0', fontSize: 12.5 }}>
          No payout rate is set yet — amounts owed can't be calculated until you set one on the{' '}
          <Link href="/admin/plans" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Plans and payment settings
          </Link>{' '}
          page ("Agent payouts" section).
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '18px 0 20px' }}>
        <Stat label="Rate per visit" value={payouts.rate != null ? money(payouts.rate) : 'Not set'} />
        <Stat label="Owed (unpaid visits)" value={payouts.rate != null ? money(totalOwed) : '—'} />
        <Stat label="Paid so far" value={money(totalPaid)} muted />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Agent', 'Approved visits', 'Unpaid', 'Owed', 'Paid so far', ''].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '8px 10px 8px 0',
                    borderBottom: '2px solid var(--color-divider)',
                    fontSize: 9.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.agents.map((a) => (
              <Fragment key={a.agentId}>
                <tr style={{ background: expandedAgent === a.agentId ? 'var(--p-tint)' : 'transparent' }}>
                  <td style={{ padding: '9px 10px 9px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.email && <div style={{ fontSize: 11, color: 'var(--p-ink-soft)' }}>{a.email}</div>}
                  </td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{a.approvedVisits}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{a.unpaidCount}</td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>
                    {a.owed != null ? money(a.owed) : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--color-divider)' }}>{money(a.paidTotal)}</td>
                  <td style={{ padding: '6px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right' }}>
                    {a.unpaidCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ minHeight: 28, fontSize: 11 }}
                        onClick={() => setExpandedAgent(expandedAgent === a.agentId ? null : a.agentId)}
                      >
                        {expandedAgent === a.agentId ? 'Close' : 'Pay'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedAgent === a.agentId && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--color-divider)' }}>
                      <PayoutForm agent={a} defaultRate={payouts.rate} onDone={() => setExpandedAgent(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {payouts.agents.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px 0', color: 'var(--p-ink-soft)' }}>
                  No agent has a completed (approved) visit yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayoutForm({ agent, defaultRate, onDone }: { agent: AgentRow; defaultRate: number | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [singleJobId, setSingleJobId] = useState(agent.unpaidJobs[0]?.jobId ?? '');
  const [amount, setAmount] = useState(defaultRate != null ? String(defaultRate) : '');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));

  function submit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('payment_method', method);
      formData.set('reference', reference);
      formData.set('notes', notes);
      formData.set('paid_at', paidAt);

      if (mode === 'bulk') {
        const rate = Number(amount);
        const result = await recordAgentPayoutBulk(
          agent.agentId,
          agent.unpaidJobs.map((j) => j.jobId),
          rate,
          formData
        );
        if (result && 'error' in result) return setError(result.error);
      } else {
        if (!singleJobId) return setError('Choose a visit.');
        formData.set('amount', amount);
        const result = await recordAgentPayout(agent.agentId, singleJobId, formData);
        if (result && 'error' in result) return setError(result.error);
      }
      onDone();
      router.refresh();
    });
  }

  return (
    <div style={{ padding: '16px 18px', background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12.5 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="radio" checked={mode === 'bulk'} onChange={() => setMode('bulk')} />
          Pay all {agent.unpaidCount} unpaid visit{agent.unpaidCount === 1 ? '' : 's'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="radio" checked={mode === 'single'} onChange={() => setMode('single')} />
          Pay one visit
        </label>
      </div>

      {mode === 'single' && (
        <div className="field" style={{ marginBottom: 10, maxWidth: 340 }}>
          <label>Visit</label>
          <select className="input" style={{ minHeight: 38 }} value={singleJobId} onChange={(e) => setSingleJobId(e.target.value)}>
            {agent.unpaidJobs.map((j) => (
              <option key={j.jobId} value={j.jobId}>
                {j.propertyName}
                {j.visitNumber ? ` · Visit ${j.visitNumber}` : ''}
                {j.decidedAt ? ` · approved ${j.decidedAt}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div className="field">
          <label>{mode === 'bulk' ? 'Amount per visit (₹)' : 'Amount (₹)'}</label>
          <input className="input" style={{ minHeight: 38 }} type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Paid on</label>
          <input className="input" style={{ minHeight: 38 }} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="field">
          <label>Method (optional)</label>
          <input className="input" style={{ minHeight: 38 }} placeholder="Cash, UPI, bank…" value={method} onChange={(e) => setMethod(e.target.value)} />
        </div>
        <div className="field">
          <label>Reference (optional)</label>
          <input className="input" style={{ minHeight: 38 }} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Notes (optional)</label>
        <input className="input" style={{ minHeight: 38 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {mode === 'bulk' && amount && (
        <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 8 }}>
          Total: {money(Number(amount) * agent.unpaidCount)} across {agent.unpaidCount} visit{agent.unpaidCount === 1 ? '' : 's'}
        </p>
      )}

      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 38, fontSize: 12.5, padding: '0 16px' }} disabled={pending || !amount} onClick={submit}>
          {pending ? 'Saving…' : 'Record payout'}
        </button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 38, fontSize: 12.5, padding: '0 16px' }} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
