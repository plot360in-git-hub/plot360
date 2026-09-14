import { getJobByToken } from '@/components/agent/magic-link.actions';
import { PublicCapture } from '@/components/agent/PublicCapture';

// Redesign 2026-09 — swapped to the new capture screen. PublicUploadForm.tsx
// is kept intact but no longer wired here — see ARCHITECTURE.md.
export default async function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getJobByToken(token);

  if ('error' in result) {
    return (
      <main className="p360" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ maxWidth: 380, textAlign: 'center', fontSize: 14.5 }}>{result.error}</p>
      </main>
    );
  }

  return <PublicCapture token={token} job={result.job} property={result.property} media={result.media} />;
}
