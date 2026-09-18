import { redirect } from 'next/navigation';
import { getMyAgentProfile } from '@/components/agent/onboarding.actions';
import { AgentOnboardingForm } from '@/components/agent/AgentOnboardingForm';

// Redesign 2026-09 (follow-up, round 22) — now only a brief stop for a
// first-time OAuth agent (no agent_profiles row yet, see
// app/agent/auth/callback/page.tsx) or a rejected agent resubmitting —
// an email/password agent's account, name, mobile and optional documents
// are all created together at signup now (agentSignUpAndRegister), so
// they normally never see this page at all.
export default async function AgentOnboardingPage() {
  const data = await getMyAgentProfile();
  if (!data) redirect('/agent/login');

  if (data.agentProfile?.status === 'verified') redirect('/agent/dashboard');
  if (data.agentProfile?.status === 'pending') redirect('/agent/dashboard');

  const dlRecord = data.documents.find((d) => d.doc_type === 'driving_license');
  const secondaryIdRecord = data.documents.find((d) => d.doc_type === 'secondary_id');

  return (
    <main>
      <AgentOnboardingForm profile={data.profile} agentProfile={data.agentProfile} hasDL={!!dlRecord} hasSecondaryId={!!secondaryIdRecord} />
    </main>
  );
}
