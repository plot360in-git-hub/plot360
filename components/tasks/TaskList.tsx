import Link from 'next/link';
import { getTasksForProperty } from './tasks.actions';

const STATUS_LABEL: Record<string, string> = {
  complete: 'Complete',
  in_progress: 'In Progress',
  not_done: 'Not Done',
};

export async function TaskList({ propertyId }: { propertyId: string }) {
  const tasks = await getTasksForProperty(propertyId);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Task History</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)', fontSize: 14 }}>
            <th style={{ padding: '8px 0' }}>S.No</th>
            <th>Task</th>
            <th>Status</th>
            <th>Start Date</th>
            <th>Completed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '12px 0' }}>{i + 1}</td>
              <td>{t.task_name}</td>
              <td>{STATUS_LABEL[t.status] ?? t.status}</td>
              <td>{t.start_date ?? '—'}</td>
              <td>{t.completed_date ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>
                <Link href={`/tasks/${t.id}`} style={{ color: 'var(--color-accent)' }}>Open</Link>
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '20px 0', color: 'var(--color-text-muted)' }}>No tasks yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
