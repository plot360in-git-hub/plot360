import { redirect } from 'next/navigation';
import { getMyAgentProfile } from '@/components/agent/onboarding.actions';
import { AgentProfileEditForm } from '@/components/agent/AgentProfileEditForm';

export default async function AgentProfileEditPage() {
  const data = await getMyAgentProfile();
  if (!data) redirect('/agent/login');
  if (!data.agentProfile) redirect('/agent/onboarding');
  if (!data.profile) redirect('/agent/login');

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <AgentProfileEditForm profile={data.profile} />
    </main>
  );
}
