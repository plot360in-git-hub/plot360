import { AgentHeader } from '@/components/layout/AgentHeader';

export default function AgentJobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentHeader />
      {children}
    </>
  );
}
