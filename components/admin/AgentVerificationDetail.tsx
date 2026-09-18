import Link from 'next/link';
import { getAgentForReview, getAgentDocumentUrl } from './agents.actions';
import { isAgentBanned } from './agent-bans.actions';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait } from '@/lib/adminQueue';
import { AgentVerificationActions } from './AgentVerificationActions';
import { AgentVerificationEditableFields } from './AgentVerificationEditableFields';
import { AgentDocumentManager } from './AgentDocumentManager';

const DOC_LABELS: Record<string, string> = {
  driving_license: 'Driving licence',
  secondary_id: 'Second government ID',
};

// Redesign 2026-09 — admin console, Agent verification detail screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). Replaces
// AgentReview.tsx on /admin/agents/[id] (kept intact, unreferenced —
// see ARCHITECTURE.md).
//
// Redesign 2026-09 (follow-up) — two Plot requests actioned here: (1)
// Mobile number/Email/SRO name/SRO number are no longer readOnly — see
// AgentVerificationEditableFields.tsx; (2) documents now support any
// number of files per type (front, back, a retake, ...) instead of one —
// see AgentDocumentManager.tsx and supabase/schema.sql's dropped
// agent_documents_agent_doctype_key constraint.
export async function AgentVerificationDetail({ agentId }: { agentId: string }) {
  const [{ agentProfile, documents }, banned] = await Promise.all([getAgentForReview(agentId), isAgentBanned(agentId)]);
  if (!agentProfile) return <p style={{ padding: 24 }}>Agent not found.</p>;

  // Redesign 2026-09 (follow-up) — grouped by doc_type instead of one row
  // per type now that multiple files per type are allowed.
  const docsByType: Record<string, { id: string; uploadedAt: string; url: string | null }[]> = { driving_license: [], secondary_id: [] };
  for (const doc of documents as any[]) {
    const url = await getAgentDocumentUrl(doc.file_path);
    (docsByType[doc.doc_type] ??= []).push({ id: doc.id, uploadedAt: doc.uploaded_at, url });
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
      <AgentVerificationEditableFields
        agentId={agentId}
        phoneCountryCode={agentProfile.profiles?.phone_country_code ?? ''}
        phoneNumber={agentProfile.profiles?.phone_number ?? ''}
        email={agentProfile.profiles?.email ?? ''}
        sroName={agentProfile.sro_name ?? ''}
        sroCode={agentProfile.sro_code ?? ''}
      />

      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Documents</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 11 }}>
        {(['driving_license', 'secondary_id'] as const).map((docType) => (
          <AgentDocumentManager key={docType} agentId={agentId} docType={docType} label={DOC_LABELS[docType]} files={docsByType[docType] ?? []} />
        ))}
      </div>

      <AgentVerificationActions agentId={agentId} agentName={profileDisplayName(agentProfile.profiles)} banned={banned} />
    </div>
  );
}
