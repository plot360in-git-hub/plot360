import { ServiceRequestScreen } from '@/components/service-requests/ServiceRequestScreen';

// Redesign 2026-09 (follow-up) — see ServiceRequestScreen.tsx. Both this
// route and app/service-requests/new/page.tsx render the same combined
// compose+list screen now, matching the design mock (which has no
// separate "list" vs "new" screens, just one). The old list markup that
// used to live directly in this file is gone; nothing else linked to it
// besides its own "New Request" button.
export default function ServiceRequestsPage() {
  return <ServiceRequestScreen />;
}
