import { getAllUsers } from './users.actions';
import { UserBanToggle } from './UserBanToggle';

function roleLabel(u: { isAdmin: boolean; isAgent: boolean }) {
  if (u.isAdmin) return 'Admin';
  if (u.isAgent) return 'Agent';
  return 'Customer';
}

export async function AdminUsersList() {
  const { users, error } = await getAllUsers();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 8 }}>All Users</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>{users.length} accounts</p>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 14 }}>
            <th style={{ padding: '8px 0' }}>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Email confirmed</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '10px 0' }}>{u.firstName} {u.lastName}</td>
              <td>{u.email}</td>
              <td>{roleLabel(u)}</td>
              <td>{u.emailConfirmed ? 'Yes' : 'No'}</td>
              <td>
                <span className={`status-pill ${u.isBanned ? 'rejected' : 'verified'}`}>
                  {u.isBanned ? 'Disabled' : 'Active'}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <UserBanToggle userId={u.id} isBanned={u.isBanned} />
              </td>
            </tr>
          ))}
          {users.length === 0 && !error && (
            <tr><td colSpan={6} style={{ padding: '20px 0', color: 'var(--color-text-muted)' }}>No users found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
