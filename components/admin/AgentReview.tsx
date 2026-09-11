import { getAgentForReview, getAgentDocumentUrl } from './agents.actions';
import { profileDisplayName } from './displayName';
import { AgentDecisionButtons } from './AgentDecisionButtons';
import { BackButton } from './BackButton';

const DOC_LABELS: Record<string, string> = {
  driving_license: 'Driving License',
  secondary_id: 'Second Govt ID (Aadhar / PAN / other)',
};

export async function AgentReview({ agentId }: { agentId: string }) {
  const { agentProfile, documents } = await getAgentForReview(agentId);
  if (!agentProfile) return <p>Agent not found.</p>;
  const profile = agentProfile.profiles;

  const documentsWithUrls = await Promise.all(
    documents.map(async (d: any) => ({ ...d, url: await getAgentDocumentUrl(d.file_path) }))
  );

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <BackButton />
      <h1 style={{ marginBottom: 4 }}>{profileDisplayName(profile)}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        {profile?.email} · {profile?.phone_country_code} {profile?.phone_number}
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Details</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24 }}>
          <div><dt className="field-label">Home Address</dt><dd>
            {[profile?.current_address?.street, profile?.current_address?.city, (profile?.current_address as any)?.district, profile?.current_address?.state, profile?.current_address?.zip].filter(Boolean).join(', ') || '—'}
          </dd></div>
          <div><dt className="field-label">Closest SRO</dt><dd>
            {agentProfile.sro_name || '—'} / {agentProfile.sro_code || '—'}
          </dd></div>
          <div><dt className="field-label">Photo</dt><dd>
            {profile?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profile_picture_url} alt="" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : '—'}
          </dd></div>
        </dl>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>ID Documents</h3>
        {documentsWithUrls.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No documents uploaded.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {documentsWithUrls.map((d) => (
            <li key={d.id} style={{ marginBottom: 8 }}>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-link)' }}>
                  {DOC_LABELS[d.doc_type] ?? d.doc_type}
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>{DOC_LABELS[d.doc_type] ?? d.doc_type} (link unavailable)</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <AgentDecisionButtons agentId={agentId} currentStatus={agentProfile.status} />
    </div>
  );
}
