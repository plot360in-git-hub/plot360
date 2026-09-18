import { redirect } from 'next/navigation';
import { getMyAgentProfile } from '@/components/agent/onboarding.actions';
import { getMyJobs } from '@/components/agent/agent-jobs.actions';
import { AgentProfileEditForm } from '@/components/agent/AgentProfileEditForm';

const COMPLETED_STATUSES = ['approved', 'ec_pending'];

export default async function AgentProfileEditPage() {
  const [data, jobs] = await Promise.all([getMyAgentProfile(), getMyJobs()]);
  if (!data) redirect('/agent/login');
  if (!data.agentProfile) redirect('/agent/onboarding');
  if (!data.profile) redirect('/agent/login');

  const completedVisits = jobs.filter((j: any) => COMPLETED_STATUSES.includes(j.status)).length;

  return (
    <main>
      <AgentProfileEditForm profile={data.profile} agentProfile={data.agentProfile} documents={data.documents} completedVisits={completedVisits} />
    </main>
  );
}
