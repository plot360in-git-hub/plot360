import { AgentHeader } from '@/components/layout/AgentHeader';

export default function AgentOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentHeader />
      {children}
    </>
  );
}
