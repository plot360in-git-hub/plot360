'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getDashboardTiles, type DashboardTile } from './dashboard.actions';
import type { AdminRole } from './admin-role.actions';
import { logOut } from '@/components/auth/auth.actions';

// Redesign 2026-09 — admin console shell (design_handoff_plot360_redesign,
// "Plot360 Admin.dc.html"): top bar + left nav with live badge counts +
// role footnote. Replaces components/layout/AdminHeader.tsx (kept
// intact, no longer wired — see app/admin/layout.tsx) which had no
// owner/operations distinction and only a flat link list.
//
// Redesign 2026-09 (follow-up, round 13) — Plot pointed out this shell has
// no way to log out at all (the legacy AdminHeader.tsx had one, but it's
// dead code now — see app/admin/layout.tsx). Added a "Log out" button to
// the top-right corner, reusing the same logOut server action and
// `.p360` btn-secondary styling as CustomerHeader.tsx's logout button.
// Redesign 2026-09 (round 34) — "Implementation Change List" item 9:
// grouped into sections (Queues / Owner) rather than one flat list, per
// the change list's own grouping suggestion — its exact example groups
// ("Verification / Renewals / Payments together, Agents / Monitoring /
// Users together") named links from the OLD, already-dead
// components/layout/AdminHeader.tsx, not this shell's real nav, so the
// groups below use this shell's actual destinations instead: every
// day-to-day queue together, then the three owner-only screens
// together. `group: null` (Dashboard alone) renders with no section
// header — a one-item group doesn't need a label over it.
const NAV: { id: string; label: string; href: string; ownerOnly?: boolean; group: string | null }[] = [
  { id: 'dash', label: 'Dashboard', href: '/admin', group: null },
  { id: 'qProperty', label: 'Property verification', href: '/admin/queue/property-verification', group: 'Queues' },
  { id: 'qAssign', label: 'Job assignment', href: '/admin/queue/job-assignment', group: 'Queues' },
  { id: 'qAgentSub', label: 'Agent submissions', href: '/admin/queue/agent-submissions', group: 'Queues' },
  { id: 'qAgentVerify', label: 'Agent verification', href: '/admin/queue/agent-verification', group: 'Queues' },
  { id: 'qService', label: 'Service requests', href: '/admin/queue/service-requests', group: 'Queues' },
  { id: 'qPayments', label: 'Payments', href: '/admin/queue/payments', group: 'Queues' },
  // Redesign 2026-09 (follow-up, 2026-09-26) — Plot: a property with an
  // agent already assigned (or in progress, or submitted) wasn't
  // reachable from anywhere in this sidebar — the six queues above only
  // ever surface a job at the exact moment it's waiting on a specific
  // admin action (unassigned, or submitted-and-unreviewed), so an
  // "assigned, agent hasn't visited yet" job (like the rest of this
  // job's lifecycle) fell into a gap no queue covers. MonitoringOverview
  // (app/admin/monitoring) already lists every job regardless of status
  // — Upcoming/Active/Completed — plus who the agent is; it just had no
  // link here, so this is a genuine "can't find it anywhere" bug, not
  // just a missing feature. Placed in Queues since it's day-to-day
  // tracking, not owner-only.
  { id: 'monitoring', label: 'Monitoring', href: '/admin/monitoring', group: 'Queues' },
  { id: 'plans', label: 'Plans & pricing', href: '/admin/plans', ownerOnly: true, group: 'Owner' },
  { id: 'users', label: 'Users', href: '/admin/users', ownerOnly: true, group: 'Owner' },
  // Redesign 2026-09 (round 32) — payments-received ledger + agent-payout
  // bookkeeping, see app/admin/accounting/page.tsx. Owner-only like Plans
  // & pricing and Users — this is internal financial data.
  { id: 'accounting', label: 'Accounting', href: '/admin/accounting', ownerOnly: true, group: 'Owner' },
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
  tiles: initialTiles,
  children,
}: {
  role: AdminRole;
  name: string;
  tiles: DashboardTile[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [tiles, setTiles] = useState(initialTiles);

  // Redesign 2026-09 (follow-up) — Plot: the sidebar's badge counts (and
  // the "Waiting on you" tiles, since both read from the same `tiles`
  // prop passed down from app/admin/layout.tsx) went stale while
  // clicking between admin pages — Property verification showing 0 left
  // to review while the sidebar still showed a leftover count from
  // earlier — and only caught up after a full logout/login. That's
  // App Router's shared-layout behavior working as designed: navigating
  // between sibling pages under the same layout does NOT re-run that
  // layout's server component (this is what lets a layout keep state
  // across nested navigation), so a value the layout fetched once on
  // first load — these tiles — never refreshes just from moving around
  // inside /admin. Refetching here, keyed on the pathname, gets fresh
  // counts on every page the admin actually visits, without needing a
  // full reload.
  useEffect(() => {
    let cancelled = false;
    getDashboardTiles().then((fresh) => {
      if (!cancelled) setTiles(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
        <form action={logOut}>
          <button type="submit" className="btn btn-secondary" style={{ minHeight: 32, fontSize: 12, padding: '0 14px', fontWeight: 700 }}>
            Log out
          </button>
        </form>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ width: 216, flex: 'none', borderRight: '2px solid var(--color-divider)', display: 'flex', flexDirection: 'column' }}>
          {(() => {
            const visible = NAV.filter((n) => !n.ownerOnly || role === 'owner');
            let lastGroup: string | null | undefined;
            return visible.map((n) => {
              const active = n.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(n.href);
              const tile = tileById[TILE_BADGE[n.id]];
              const showHeader = n.group && n.group !== lastGroup;
              lastGroup = n.group;
              return (
                <div key={n.id}>
                  {showHeader && (
                    <div
                      style={{
                        padding: '12px 14px 5px',
                        fontSize: 9.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--p-ink-soft)',
                      }}
                    >
                      {n.group}
                    </div>
                  )}
                  <Link
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
                </div>
              );
            });
          })()}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '13px 14px', fontSize: 10.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, borderTop: '1px solid var(--color-divider)' }}>
            Operations sees queues and assignment. Owner also sees plans, pricing, users and accounting.
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
