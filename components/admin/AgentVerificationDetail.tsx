import Link from 'next/link';
import { getAgentForReview, getAgentDocumentUrl } from './agents.actions';
import { isAgentBanned } from './agent-bans.actions';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait } from '@/lib/adminQueue';
import { AgentVerificationActions } from './AgentVerificationActions';

const DOC_LABELS: Record<string, string> = {
  driving_license: 'Driving licence',
  secondary_id: 'Second government ID',
};

// Redesign 2026-09 — admin console, Agent verification detail screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). Replaces
// AgentReview.tsx on /admin/agents/[id] (kept intact, unreferenced —
// see ARCHITECTURE.md). The design mock shows four document cards
// (licence + Aadhaar, front/back); the real schema only ever collects
// two (agent_documents.doc_type: driving_license, secondary_id), so
// this shows two, honestly, rather than fabricating a front/back split
// that doesn't exist in the data.
export async function AgentVerificationDetail({ agentId }: { agentId: string }) {
  const [{ agentProfile, documents }, banned] = await Promise.all([getAgentForReview(agentId), isAgentBanned(agentId)]);
  if (!agentProfile) return <p style={{ padding: 24 }}>Agent not found.</p>;

  const docUrls: Record<string, string | null> = {};
  for (const doc of documents) {
    docUrls[doc.doc_type] = await getAgentDocumentUrl(doc.file_path);
  }
  const waitHours = hoursSince(agentProfile.created_at);

  return (
    <div style={{ padding: '22px 26px 30px', maxWidth: 760 }}>
      <Link href="/admin/queue/agent-verification" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
        ← Back to queue
      </Link>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>{profileDisplayName(agentProfile.profiles)}</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
        signed up {agentProfile.created_at?.slice(0, 10)} · waiting {formatWait(waitHours)}
      </div>

      {banned && (
        <div style={{ background: 'var(--color-text)', color: 'var(--color-bg)', padding: '12px 14px', marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, background: 'var(--color-accent)', flex: 'none' }} />
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>Login disabled. This agent cannot sign in and is hidden from assignment suggestions.</div>
        </div>
      )}

      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>Mobile number</label>
          <input className="input" style={{ minHeight: 38 }} value={`${agentProfile.profiles?.phone_country_code ?? ''} ${agentProfile.profiles?.phone_number ?? ''}`} readOnly />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="input" style={{ minHeight: 38 }} value={agentProfile.profiles?.email ?? ''} readOnly />
        </div>
        <div className="field">
          <label>SRO name</label>
          <input className="input" style={{ minHeight: 38 }} value={agentProfile.sro_name ?? ''} readOnly />
        </div>
        <div className="field">
          <label>SRO number</label>
          <input className="input" style={{ minHeight: 38 }} value={agentProfile.sro_code ?? ''} readOnly />
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 8 }}>Jobs are matched to this SRO number against the property's SRO.</div>

      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Documents</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 11 }}>
        {(['driving_license', 'secondary_id'] as const).map((docType) => {
          const present = documents.some((d: any) => d.doc_type === docType);
          const url = docUrls[docType];
          return (
            <div key={docType} style={{ border: `1px solid ${present ? 'var(--color-divider)' : 'var(--color-accent)'}`, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600 }}>{DOC_LABELS[docType]}</div>
                <div style={{ fontSize: 10.5, color: present ? 'var(--p-ink-soft)' : 'var(--p-alert)' }}>{present ? 'Attached' : 'Missing'}</div>
              </div>
              <div style={{ height: 78, background: 'var(--color-neutral-300)', marginTop: 9 }} />
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 11, marginTop: 9, display: 'inline-flex' }}>
                  View full size
                </a>
              )}
            </div>
          );
        })}
      </div>

      <AgentVerificationActions agentId={agentId} agentName={profileDisplayName(agentProfile.profiles)} banned={banned} />
    </div>
  );
}
