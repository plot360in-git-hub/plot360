import { getAllUsers } from './users.actions';
import { getAgentsForUsersTab } from './agent-bans.actions';
import { UsersTable } from './UsersTable';

// Redesign 2026-09 — admin console, Users screen (design_handoff_
// plot360_redesign, "Plot360 Admin.dc.html"). Owner role only — gated
// server-side by app/admin/users/page.tsx. Replaces AdminUsersList.tsx
// (kept intact, unreferenced — see ARCHITECTURE.md), which listed
// everyone in one flat table; this splits Customers / Field agents per
// the design, and — critically — the Field agents tab's ban flag reads
// from the SAME `bans` table row the agent-detail Disable/Enable toggle
// writes (agent-bans.actions.ts), never Supabase Auth's ban_duration,
// so the two surfaces can never disagree.
export async function UsersPage() {
  const [{ users }, agents] = await Promise.all([getAllUsers(), getAgentsForUsersTab()]);
  const customers = (users ?? []).filter((u: any) => !u.isAgent);

  return (
    <div style={{ padding: '22px 26px 30px' }}>
      <UsersTable customers={customers} agents={agents} />
    </div>
  );
}
