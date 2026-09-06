import { CustomerRegistrationForm } from '@/components/onboarding/CustomerRegistrationForm';

export default function OnboardingPage() {
  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <CustomerRegistrationForm />
    </main>
  );
}
