import { AgentHeader } from '@/components/layout/AgentHeader';

export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgentHeader />
      {children}
    </>
  );
}
