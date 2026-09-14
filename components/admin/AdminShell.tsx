'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DashboardTile } from './dashboard.actions';
import type { AdminRole } from './admin-role.actions';

// Redesign 2026-09 — admin console shell (design_handoff_plot360_redesign,
// "Plot360 Admin.dc.html"): top bar + left nav with live badge counts +
// role footnote. Replaces components/layout/AdminHeader.tsx (kept
// intact, no longer wired — see app/admin/layout.tsx) which had no
// owner/operations distinction and only a flat link list.
const NAV: { id: string; label: string; href: string; ownerOnly?: boolean }[] = [
  { id: 'dash', label: 'Dashboard', href: '/admin' },
  { id: 'qProperty', label: 'Property verification', href: '/admin/queue/property-verification' },
  { id: 'qAssign', label: 'Job assignment', href: '/admin/queue/job-assignment' },
  { id: 'qAgentSub', label: 'Agent submissions', href: '/admin/queue/agent-submissions' },
  { id: 'qAgentVerify', label: 'Agent verification', href: '/admin/queue/agent-verification' },
  { id: 'qService', label: 'Service requests', href: '/admin/queue/service-requests' },
  { id: 'qPayments', label: 'Payments', href: '/admin/queue/payments' },
  { id: 'plans', label: 'Plans & pricing', href: '/admin/plans', ownerOnly: true },
  { id: 'users', label: 'Users', href: '/admin/users', ownerOnly: true },
];

const TILE_BADGE: Record<string, string> = {
  qProperty: 'qProperty',
  qAssign: 'qAssign',
  qAgentSub: 'qAgentSub',
  qAgentVerify: 'qAgentVerify',
  qService: 'qService',
  qPayments: 'qPayments',
};

export function AdminShell({
  role,
  name,
  tiles,
  children,
}: {
  role: AdminRole;
  name: string;
  tiles: DashboardTile[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const tileById: Record<string, DashboardTile> = {};
  for (const t of tiles) tileById[t.id] = t;

  return (
    <div className="p360" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 18, padding: '14px 24px', borderBottom: '2px solid var(--color-divider)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>
          PLOT<span style={{ color: 'var(--color-accent)' }}>360</span>{' '}
          <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--p-ink-soft)' }}>Admin</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>
          {name} · {role === 'owner' ? 'owner · full access' : 'operations · queues and assignment'}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ width: 216, flex: 'none', borderRight: '2px solid var(--color-divider)', display: 'flex', flexDirection: 'column' }}>
          {NAV.filter((n) => !n.ownerOnly || role === 'owner').map((n) => {
            const active = n.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(n.href);
            const tile = tileById[TILE_BADGE[n.id]];
            return (
              <Link
                key={n.id}
                href={n.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--color-divider)',
                  background: active ? 'var(--color-text)' : 'transparent',
                  color: active ? 'var(--color-bg)' : 'var(--color-text)',
                  fontSize: 12.5,
                  padding: '11px 14px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ flex: 1 }}>{n.label}</span>
                {tile && tile.count > 0 && (
                  <span
                    style={{
                      flex: 'none',
                      minWidth: 20,
                      textAlign: 'center',
                      background: tile.late > 4 ? 'var(--color-accent)' : active ? 'var(--color-bg)' : 'var(--color-text)',
                      color: tile.late > 4 ? 'var(--color-bg)' : active ? 'var(--color-text)' : 'var(--color-bg)',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: 10.5,
                      padding: '2px 5px',
                    }}
                  >
                    {tile.count}
                  </span>
                )}
              </Link>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '13px 14px', fontSize: 10.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, borderTop: '1px solid var(--color-divider)' }}>
            Operations sees queues and assignment. Owner also sees plans, pricing and users.
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
