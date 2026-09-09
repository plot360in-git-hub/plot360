import { NewServiceRequestForm } from '@/components/service-requests/NewServiceRequestForm';

export default function NewServiceRequestPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <NewServiceRequestForm />
    </main>
  );
}
