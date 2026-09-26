import Link from 'next/link';
import { getEligiblePropertiesForAssignment, getVerifiedAgentsList, getAllMonitoringJobs } from './monitoring.actions';
import { getLatestPaymentsForProperties } from '@/components/payments/payments.actions';
import { profileDisplayName } from './displayName';
import { AssignAgentForm } from './AssignAgentForm';
import { ResendWhatsAppButton } from './ResendWhatsAppButton';
import { ReassignAgentForm } from './ReassignAgentForm';
import { MonitoringSearchBox } from './MonitoringSearchBox';

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Assigned — ready for agent to work',
  accepted: 'In progress',
  submitted: 'Submitted — needs review',
  approved: 'Completed',
  rejected: 'Rejected — resend for reverify',
  ec_pending: 'EC pending — upload to close',
};
const STATUS_CLASS: Record<string, string> = {
  assigned: 'pending',
  accepted: 'pending',
  submitted: 'pending',
  approved: 'verified',
  rejected: 'rejected',
  ec_pending: 'pending',
};

const PROPERTY_STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  pending: 'Verification pending',
  rejected: 'Verification rejected',
};
const PROPERTY_STATUS_CLASS: Record<string, string> = {
  verified: 'verified',
  pending: 'pending',
  rejected: 'rejected',
};

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: added the agent's
// phone number beside their name in both Active and Completed rows below
// (getAllMonitoringJobs already joins it), so admin can call them
// directly while tracking a job instead of opening the agent's record.
function agentLabel(agentProfile: any) {
  const name = profileDisplayName(agentProfile?.profiles);
  const phone = agentProfile?.profiles?.phone_number;
  return phone ? `${name} (${agentProfile.profiles.phone_country_code ?? ''} ${phone})` : name;
}

function paymentPill(payment: any) {
  const status = payment?.status === 'completed' ? 'Completed' : payment ? 'Pending' : 'None on file';
  const cls = payment?.status === 'completed' ? 'verified' : payment ? 'pending' : 'rejected';
  return (
    <span className={`status-pill ${cls}`} style={{ fontSize: 10.5 }}>
      Payment: {status}
    </span>
  );
}

// A single case-insensitive substring match across every field an admin
// might type — property name, the owner's name/email/phone, the agent's
// name/email, and the SRO reference — so one search box answers "find
// this customer or property" regardless of which of those they typed.
function matches(query: string, ...values: (string | null | undefined)[]) {
  if (!query) return true;
  return values.some((v) => (v ?? '').toLowerCase().includes(query));
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: "1 visit is over and
// report is not visible... in admin this property is not showing up
// anywhere... difficult to track if agent assigned, who's working on it,
// did they complete, did admin review it." Root cause was twofold:
//
// 1. This page — the one screen in the whole admin console that lists a
//    job for its ENTIRE lifecycle (Upcoming/Active/Completed), not just
//    the instant it enters one specific queue — had no link in the
//    sidebar (see AdminShell.tsx's NAV, fixed alongside this). The two
//    narrow queues (Job assignment / Agent submissions) only ever show a
//    job at the exact moment it's waiting on a specific admin action, so
//    "assigned, agent hasn't visited yet" — exactly this case — was
//    genuinely unreachable, not just easy to miss.
// 2. Even once found, this page couldn't be searched by customer or
//    property name, and didn't show verification/payment status inline —
//    an admin chasing one customer's complaint had to already know which
//    of the three sections their job was in, then cross-reference the
//    property and payment screens separately to get the full picture.
//
// query (from the new search box, ?q= on this page) now filters every
// section by property name, owner name/email/phone, agent name/email, or
// SRO reference; each Active/Completed row also shows the property's
// verification status and latest payment status inline, so this one page
// answers "is it verified, is it paid, is it assigned, who to, has it
// been submitted, has admin reviewed it, is it closed" without leaving it.
export async function MonitoringOverview({ query = '' }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const [eligible, agents, allJobs] = await Promise.all([
    getEligiblePropertiesForAssignment(),
    getVerifiedAgentsList(),
    getAllMonitoringJobs(),
  ]);

  const active = allJobs.filter((j: any) => ['assigned', 'accepted', 'submitted', 'rejected', 'ec_pending'].includes(j.status));
  const completed = allJobs.filter((j: any) => j.status === 'approved');

  const propertyIds = Array.from(
    new Set([...eligible.map((p: any) => p.id), ...active.map((j: any) => j.properties?.id).filter(Boolean), ...completed.map((j: any) => j.properties?.id).filter(Boolean)])
  );
  const paymentsByProperty = await getLatestPaymentsForProperties(propertyIds);

  const filteredEligible = eligible.filter((p: any) =>
    matches(
      q,
      p.property_name,
      p.sro_name,
      p.sro_code,
      p.village_town,
      p.district,
      profileDisplayName(p.profiles),
      p.profiles?.email
    )
  );
  const filteredActive = active.filter((j: any) =>
    matches(
      q,
      j.properties?.property_name,
      profileDisplayName(j.properties?.profiles),
      j.properties?.profiles?.email,
      j.properties?.profiles?.phone_number,
      profileDisplayName(j.agent_profiles?.profiles),
      j.agent_profiles?.profiles?.email,
      j.agent_profiles?.profiles?.phone_number
    )
  );
  const filteredCompleted = completed.filter((j: any) =>
    matches(
      q,
      j.properties?.property_name,
      profileDisplayName(j.properties?.profiles),
      j.properties?.profiles?.email,
      j.properties?.profiles?.phone_number,
      profileDisplayName(j.agent_profiles?.profiles),
      j.agent_profiles?.profiles?.email,
      j.agent_profiles?.profiles?.phone_number
    )
  );

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1>Property Monitoring</h1>
        <MonitoringSearchBox placeholder="Search customer, property, agent or SRO" />
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 32 }}>
        Every visit for every property, at whatever stage it's at — verification, payment, assignment, in progress, submitted, or closed.
      </p>

      <h3 style={{ marginBottom: 4 }}>Upcoming — needs assignment</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
        Verified and paid properties due for their twice-yearly physical check
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {filteredEligible.map((p: any) => {
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
        {eligible.length > 0 && filteredEligible.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No match here for "{query}".</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Active assignments</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>All jobs currently in progress</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {filteredActive.map((j: any) => {
          const propertyStatus = j.properties?.status;
          const payment = j.properties?.id ? paymentsByProperty?.[j.properties.id] : null;
          return (
            <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <Link href={`/admin/monitoring/${j.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
                  Customer: {profileDisplayName(j.properties?.profiles)} · Agent: {agentLabel(j.agent_profiles)}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {propertyStatus && (
                    <span className={`status-pill ${PROPERTY_STATUS_CLASS[propertyStatus] ?? 'pending'}`} style={{ fontSize: 10.5 }}>
                      {PROPERTY_STATUS_LABEL[propertyStatus] ?? propertyStatus}
                    </span>
                  )}
                  {paymentPill(payment)}
                </div>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
                <span className={`status-pill ${STATUS_CLASS[j.status]}`}>{STATUS_LABEL[j.status] ?? j.status}</span>
                {j.status !== 'submitted' && j.status !== 'ec_pending' && <ResendWhatsAppButton jobId={j.id} status={j.status} />}
                {['assigned', 'accepted', 'rejected'].includes(j.status) && (
                  <ReassignAgentForm jobId={j.id} agents={agents} currentAgentId={j.agent_id} />
                )}
              </div>
            </div>
          );
        })}
        {active.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No active assignments.</p>}
        {active.length > 0 && filteredActive.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No match here for "{query}".</p>}
      </div>

      <h3 style={{ marginBottom: 4 }}>Completed</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>Approved monitoring visits</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredCompleted.map((j: any) => {
          const propertyStatus = j.properties?.status;
          const payment = j.properties?.id ? paymentsByProperty?.[j.properties.id] : null;
          return (
            <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ marginBottom: 4 }}>{j.properties?.property_name}</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
                  Customer: {profileDisplayName(j.properties?.profiles)} · Agent: {agentLabel(j.agent_profiles)} · Approved{' '}
                  {j.decided_at?.slice(0, 10)} · Next due: {j.properties?.next_monitoring_due_date ?? '—'}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {propertyStatus && (
                    <span className={`status-pill ${PROPERTY_STATUS_CLASS[propertyStatus] ?? 'pending'}`} style={{ fontSize: 10.5 }}>
                      {PROPERTY_STATUS_LABEL[propertyStatus] ?? propertyStatus}
                    </span>
                  )}
                  {paymentPill(payment)}
                </div>
              </div>
              <span className="status-pill verified" style={{ flex: 'none' }}>Completed</span>
            </div>
          );
        })}
        {completed.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing completed yet.</p>}
        {completed.length > 0 && filteredCompleted.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No match here for "{query}".</p>}
      </div>
    </div>
  );
}
