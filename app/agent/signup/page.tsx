import { AgentSignupForm } from '@/components/agent/AgentSignupForm';

export const maxDuration = 30;

export default function AgentSignupPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 60 }}>
      <AgentSignupForm />
    </main>
  );
}
