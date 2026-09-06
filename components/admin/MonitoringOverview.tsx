import Link from 'next/link';
import { getEligiblePropertiesForAssignment, getVerifiedAgentsList, getAllMonitoringJobs } from './monitoring.actions';
import { getLatestPaymentsForProperties } from '@/components/payments/payments.actions';
import { profileDisplayName } from './displayName';
import { AssignAgentForm } from './AssignAgentForm';
import { ResendWhatsAppButton } from './ResendWhatsAppButton';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned — ready for agent to work',
  accepted: 'In progress',
  submitted: 'Submitted — needs review',
  approved: 'Completed',
  rejected: 'Rejected — resubmission needed',
};
const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
};

export async function MonitoringOverview() {
  const [eligible, agents, allJobs] = await Promise.all([
    getEligiblePropertiesForAssignment(),
    getVerifiedAgentsList(),
    getAllMonitoringJobs(),
  ]);

  const paymentsByProperty = await getLatestPaymentsForProperties(eligible.map((p: any) => p.id));

  const active = allJobs.filter((j: any) => ['assigned', 'accepted', 'submitted'].includes(j.status));
  const completed = allJobs.filter((j: any) => j.status === 'approved');

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ marginBottom: 32 }}>Property Monitoring</h1>

      <h3 style={{ marginBottom: 4 }}>Upcoming — needs assignment</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
        Verified and paid properties due for their twice-yearly physical check
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {eligible.map((p: any) => {
          const payment = paymentsByProperty?.[p.id];
          return (
            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>
                  <a href={`/admin/${p.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text)' }}>
                    {p.property_name}
                  </a>
                </h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
                  {p.street_address}, {p.village_town}, {p.district} · SRO: {p.sro_name || '—'} / {p.sro_code || '—'} ·{' '}
                  {profileDisplayName(p.profiles)}
                </p>
                <p style={{ fontSize: 13 }}>
                  Next due: {p.next_monitoring_due_date ?? '—'} ·{' '}
                  <span className={`status-pill ${payment?.status === 'completed' ? 'verified' : 'pending'}`}>
                    Payment: {payment?.status === 'completed' ? 'Completed' : 'Pending'}
                  </span>
                </p>
              </div>
              <AssignAgentForm propertyId={p.id} agents={agents} />
            </div>
          );
        })}
        {eligible.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing needs assignment right now.</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Active assignments</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>All jobs currently in progress</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {active.map((j: any) => (
          <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link href={`/admin/monitoring/${j.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
              <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                Agent: {profileDisplayName(j.agent_profiles?.profiles)}
              </p>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`status-pill ${STATUS_CLASS[j.status]}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
              {j.status !== 'submitted' && <ResendWhatsAppButton jobId={j.id} />}
            </div>
          </div>
        ))}
        {active.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No active assignments.</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Completed</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>Approved monitoring visits</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {completed.map((j: any) => (
          <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                Agent: {profileDisplayName(j.agent_profiles?.profiles)} · Approved {j.decided_at?.slice(0, 10)} ·{' '}
                Next due: {j.properties?.next_monitoring_due_date ?? '—'}
              </p>
            </div>
            <span className="status-pill verified">Completed</span>
          </div>
        ))}
        {completed.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing completed yet.</p>}
      </div>
    </div>
  );
}
