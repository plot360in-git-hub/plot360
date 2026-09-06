import { AgentHeader } from '@/components/layout/AgentHeader';

export default function AgentProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentHeader />
      {children}
    </>
  );
}
