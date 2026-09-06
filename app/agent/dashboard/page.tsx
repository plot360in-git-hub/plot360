import { redirect } from 'next/navigation';
import { getAgentGateStatus } from '@/components/agent/agent-auth.actions';
import { AgentJobList } from '@/components/agent/AgentJobList';

export default async function AgentDashboardPage() {
  const gate = await getAgentGateStatus();
  if (gate === 'unauthenticated') redirect('/agent/login');
  if (gate === 'needs_onboarding') redirect('/agent/onboarding');
  if (gate === 'pending') {
    return (
      <main className="container-narrow" style={{ paddingTop: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p>Your registration is awaiting admin verification.</p>
        </div>
      </main>
    );
  }
  if (gate === 'rejected') redirect('/agent/onboarding');

  return <AgentJobList />;
}
