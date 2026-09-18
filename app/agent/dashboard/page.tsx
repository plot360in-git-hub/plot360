import { redirect } from 'next/navigation';
import { getAgentGateStatus } from '@/components/agent/agent-auth.actions';
import { getMyAgentProfile } from '@/components/agent/onboarding.actions';
import { AgentJobsHome } from '@/components/agent/AgentJobsHome';
import { AgentUnderReview } from '@/components/agent/AgentUnderReview';

// Redesign 2026-09 — swapped to the new "My jobs" screen (design_handoff_
// plot360_redesign, "Plot360 Agent.dc.html"). AgentJobList.tsx is kept
// intact but no longer wired here — see ARCHITECTURE.md.
//
// Redesign 2026-09 (follow-up, round 22) — the pending branch now renders
// the fuller "Account under review" screen (AgentUnderReview.tsx) instead
// of just the black header block.
export default async function AgentDashboardPage() {
  const gate = await getAgentGateStatus();
  if (gate === 'unauthenticated') redirect('/agent/login');
  if (gate === 'needs_onboarding') redirect('/agent/onboarding');
  if (gate === 'pending') {
    const data = await getMyAgentProfile();
    if (!data?.agentProfile) redirect('/agent/onboarding');
    return <AgentUnderReview profile={data.profile} agentProfile={data.agentProfile} documents={data.documents} />;
  }
  if (gate === 'rejected') redirect('/agent/onboarding');
  // Redesign 2026-09 — admin console: banned agents (components/admin/
  // agent-bans.actions.ts) are signed out at login, but this covers an
  // already-open session too.
  if (gate === 'banned') {
    return (
      <main className="p360" style={{ minHeight: '60vh' }}>
        <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '26px 22px 24px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Account disabled</p>
          <h1 style={{ fontSize: 24, marginTop: 12 }}>This account can no longer sign in.</h1>
          <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 11 }}>
            Contact Plot360 support if you believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  return <AgentJobsHome />;
}
