import { getJobByToken } from '@/components/agent/magic-link.actions';
import { PublicUploadForm } from '@/components/agent/PublicUploadForm';

export default async function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getJobByToken(token);

  if ('error' in result) {
    return (
      <main className="container-narrow" style={{ paddingTop: 60 }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <p>{result.error}</p>
        </div>
      </main>
    );
  }

  return <PublicUploadForm token={token} job={result.job} property={result.property} media={result.media} />;
}
