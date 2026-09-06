import Link from 'next/link';
import { getMyJobs } from './agent-jobs.actions';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Ready — visit and upload',
  accepted: 'Ready — visit and upload',
  submitted: 'Submitted — awaiting review',
  approved: 'Completed',
  rejected: 'Changes requested',
};

const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
};

export async function AgentJobList() {
  const jobs = await getMyJobs();

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 24 }}>My Assigned Jobs</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {jobs.map((j: any) => (
          <Link
            key={j.id}
            href={`/agent/jobs/${j.id}`}
            className="card"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                {j.properties?.street_address}, {j.properties?.village_town}, {j.properties?.district}, {j.properties?.state}
              </p>
            </div>
            <span className={`status-pill ${STATUS_CLASS[j.status]}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
          </Link>
        ))}
        {jobs.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No jobs assigned yet.</p>}
      </div>
    </div>
  );
}
