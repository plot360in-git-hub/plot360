import { ServiceRequestScreen } from '@/components/service-requests/ServiceRequestScreen';

// Redesign 2026-09 (follow-up) — see ServiceRequestScreen.tsx and
// app/service-requests/page.tsx. NewServiceRequestForm.tsx (the old form
// this route used to render) is untouched and still exists, just unwired.
export default function NewServiceRequestPage() {
  return <ServiceRequestScreen />;
}
