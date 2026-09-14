import { AgentCapture } from '@/components/agent/AgentCapture';

// Redesign 2026-09 — swapped to the new capture screen (design_handoff_
// plot360_redesign, "Plot360 Agent.dc.html"). AgentJobDetail.tsx is kept
// intact but no longer wired here — see ARCHITECTURE.md.
export default async function AgentJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentCapture jobId={id} />;
}
