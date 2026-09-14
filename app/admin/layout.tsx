import { getCurrentAdminContext } from '@/components/admin/admin-role.actions';
import { getDashboardTiles } from '@/components/admin/dashboard.actions';
import { AdminShell } from '@/components/admin/AdminShell';

// Redesign 2026-09 — swapped to the new admin console shell
// (AdminShell — full left nav with live badge counts + owner/operations
// role footnote). components/layout/AdminHeader.tsx is kept intact but
// no longer wired here — see ARCHITECTURE.md. Only wraps children in
// the shell once there's a real signed-in admin to show; the login
// page (and an unauthenticated/non-admin visit, which each page
// redirects away from on its own) renders bare so it isn't shown
// inside chrome meant for a logged-in admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAdminContext();
  if (!ctx.ok) return <>{children}</>;

  const tiles = await getDashboardTiles();
  return (
    <AdminShell role={ctx.role} name={ctx.name} tiles={tiles}>
      {children}
    </AdminShell>
  );
}
