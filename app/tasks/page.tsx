import Link from 'next/link';
import { getAllTasksForCurrentUser } from '@/components/tasks/tasks.actions';
import { getAllMonitoringForCurrentUser } from '@/components/properties/monitoring/monitoring.actions';

const TASK_STATUS_LABEL: Record<string, string> = {
  not_done: 'Not Done',
  in_progress: 'In Progress',
  complete: 'Complete',
};
const MONITORING_STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned — visit in progress',
  accepted: 'Agent visiting the property',
  submitted: 'Agent submitted — under admin review',
  approved: 'Verified by field agent',
  rejected: 'Sent back to agent for changes',
};
const STATUS_CLASS: Record<string, string> = {
  not_done: 'pending',
  in_progress: 'pending',
  complete: 'verified',
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
};

export default async function AllTasksPage() {
  const [tasks, monitoringJobs] = await Promise.all([
    getAllTasksForCurrentUser(),
    getAllMonitoringForCurrentUser(),
  ]);

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 32 }}>All Tasks</h1>

      <h3 style={{ marginBottom: 16 }}>Physical Verification (Monitoring)</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {monitoringJobs.map((j: any) => (
          <Link
            key={j.id}
            href={`/properties/${j.properties?.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                {j.decided_at?.slice(0, 10) ?? j.submitted_at?.slice(0, 10) ?? j.accepted_at?.slice(0, 10) ?? j.assigned_at?.slice(0, 10)}
              </p>
            </div>
            <span className={`status-pill ${STATUS_CLASS[j.status]}`}>{MONITORING_STATUS_LABEL[j.status] ?? j.status}</span>
          </Link>
        ))}
        {monitoringJobs.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No monitoring visits yet.</p>}
      </div>

      <h3 style={{ marginBottom: 16 }}>Other Tasks</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.map((t: any) => (
          <Link
            key={t.id}
            href={`/tasks/${t.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{t.task_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t.properties?.property_name} · {t.start_date ?? '—'}</p>
            </div>
            <span className={`status-pill ${STATUS_CLASS[t.status]}`}>{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
          </Link>
        ))}
        {tasks.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No other tasks yet.</p>}
      </div>
    </div>
  );
}
