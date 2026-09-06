import { redirect } from 'next/navigation';
import { getMyAgentProfile, getMyAgentDocumentUrl } from '@/components/agent/onboarding.actions';
import { AgentOnboardingForm } from '@/components/agent/AgentOnboardingForm';

function filenameFromPath(path: string) {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

export default async function AgentOnboardingPage() {
  const data = await getMyAgentProfile();
  if (!data) redirect('/agent/login');

  if (data.agentProfile?.status === 'verified') redirect('/agent/dashboard');
  if (data.agentProfile?.status === 'pending') {
    return (
      <main className="container-narrow" style={{ paddingTop: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p>Your registration is submitted and awaiting admin verification.</p>
        </div>
      </main>
    );
  }

  const dlRecord = data.documents.find((d) => d.doc_type === 'driving_license');
  const secondaryIdRecord = data.documents.find((d) => d.doc_type === 'secondary_id');

  const [dlUrl, secondaryIdUrl] = await Promise.all([
    dlRecord ? getMyAgentDocumentUrl(dlRecord.file_path) : null,
    secondaryIdRecord ? getMyAgentDocumentUrl(secondaryIdRecord.file_path) : null,
  ]);

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <AgentOnboardingForm
        profile={data.profile}
        agentProfile={data.agentProfile}
        hasDL={!!dlRecord}
        hasSecondaryId={!!secondaryIdRecord}
        dlDoc={dlRecord ? { name: filenameFromPath(dlRecord.file_path), url: dlUrl } : null}
        secondaryIdDoc={secondaryIdRecord ? { name: filenameFromPath(secondaryIdRecord.file_path), url: secondaryIdUrl } : null}
      />
    </main>
  );
}
