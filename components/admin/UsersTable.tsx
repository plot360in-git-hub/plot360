'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleUserBan } from './users.actions';
import { toggleAgentBan } from './agent-bans.actions';

function displayCustomer(u: any) {
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || u.email || 'Unknown';
}
function displayAgent(a: any) {
  const p = a.profiles;
  const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();
  return name || p?.email || 'Unknown';
}

export function UsersTable({ customers, agents }: { customers: any[]; agents: any[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'customers' | 'agents'>('customers');
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => !q || `${displayCustomer(c)} ${c.email ?? ''}`.toLowerCase().includes(q));
  const filteredAgents = agents.filter((a) => !q || `${displayAgent(a)} ${a.sro_name ?? ''} ${a.sro_code ?? ''}`.toLowerCase().includes(q));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Users</h2>
          <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
            {tab === 'agents'
              ? 'Owner role only. Banning stops an agent signing in and removes them from assignment suggestions; completed visits are untouched.'
              : 'Owner role only. Banning stops a customer signing in; their properties and credits are untouched.'}
          </div>
        </div>
        <input className="input" style={{ minHeight: 36, width: 230, flex: 'none' }} placeholder={tab === 'agents' ? 'Search agent, ID or SRO' : 'Search name or phone'} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div style={{ display: 'flex', border: '1px solid var(--color-divider)', width: 'max-content', marginTop: 14 }}>
        {(['customers', 'agents'] as const).map((t) => (
          <button
            key={t}
            type="button"
            style={{ minHeight: 32, border: 0, borderRight: t === 'customers' ? '1px solid var(--color-divider)' : 0, background: tab === t ? 'var(--color-text)' : 'transparent', color: tab === t ? 'var(--color-bg)' : 'var(--color-text)', fontSize: 11.5, padding: '0 14px', cursor: 'pointer' }}
            onClick={() => setTab(t)}
          >
            {t === 'customers' ? 'Customers' : 'Field agents'}
          </button>
        ))}
      </div>

      {tab === 'customers' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr>
              {['Customer', 'Signed up', 'Email confirmed', 'Role', 'Status', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px 8px 0', borderBottom: '2px solid var(--color-divider)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.id} style={{ background: c.isBanned ? 'var(--p-tint)' : 'transparent' }}>
                <td style={{ padding: '8px 10px 8px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{displayCustomer(c)}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{c.createdAt?.slice(0, 10)}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{c.emailConfirmed ? 'Yes' : 'No'}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{c.isAdmin ? 'Admin' : 'Customer'}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: c.isBanned ? 'var(--p-alert)' : 'var(--color-text)' }}>{c.isBanned ? 'Banned' : 'Active'}</td>
                <td style={{ padding: '5px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 28, fontSize: 11, padding: '0 10px', color: c.isBanned ? 'var(--color-text)' : 'var(--p-alert)' }}
                    disabled={pending}
                    onClick={() => startTransition(async () => { await toggleUserBan(c.id, !c.isBanned); router.refresh(); })}
                  >
                    {c.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '20px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--p-ink-soft)' }}>
                  No customers match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 16 }}>
          <thead>
            <tr>
              {['Agent', 'SRO', 'Visits done', 'Status', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px 8px 0', borderBottom: '2px solid var(--color-divider)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAgents.map((a) => (
              <tr key={a.id} style={{ background: a.isBanned ? 'var(--p-tint)' : 'transparent' }}>
                <td style={{ padding: '8px 10px 8px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{displayAgent(a)}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{[a.sro_name, a.sro_code].filter(Boolean).join(' ')}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{a.visitsDone}</td>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-divider)', color: a.isBanned ? 'var(--p-alert)' : 'var(--color-text)' }}>{a.isBanned ? 'Banned' : 'Active'}</td>
                <td style={{ padding: '5px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ minHeight: 28, fontSize: 11, padding: '0 10px', color: a.isBanned ? 'var(--color-text)' : 'var(--p-alert)' }}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const reason = a.isBanned ? undefined : window.prompt('Reason for banning this agent (shown internally only):') || '';
                        if (!a.isBanned && reason === null) return;
                        await toggleAgentBan(a.id, !a.isBanned, reason);
                        router.refresh();
                      })
                    }
                  >
                    {a.isBanned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            ))}
            {filteredAgents.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '20px 0', borderBottom: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--p-ink-soft)' }}>
                  No agents match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 13 }}>
        {tab === 'agents' ? 'A banned agent keeps their visit history; open jobs must be reassigned by hand.' : 'A banned customer keeps their reports; nothing is deleted.'} Unbanning restores sign-in immediately.
      </p>
    </div>
  );
}
