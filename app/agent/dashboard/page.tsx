import { redirect } from 'next/navigation';
import { getAgentGateStatus } from '@/components/agent/agent-auth.actions';
import { AgentJobsHome } from '@/components/agent/AgentJobsHome';

// Redesign 2026-09 — swapped to the new "My jobs" screen (design_handoff_
// plot360_redesign, "Plot360 Agent.dc.html"). AgentJobList.tsx is kept
// intact but no longer wired here — see ARCHITECTURE.md.
export default async function AgentDashboardPage() {
  const gate = await getAgentGateStatus();
  if (gate === 'unauthenticated') redirect('/agent/login');
  if (gate === 'needs_onboarding') redirect('/agent/onboarding');
  if (gate === 'pending') {
    return (
      <main className="p360" style={{ minHeight: '60vh' }}>
        <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '26px 22px 24px' }}>
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>Under review</p>
          <h1 style={{ fontSize: 24, marginTop: 12 }}>Account created. Verification takes a day.</h1>
          <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 11 }}>
            A reviewer checks your details and documents. If anything is missing we message you on WhatsApp and you
            can add it from your profile.
          </p>
        </div>
      </main>
    );
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
