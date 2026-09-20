'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadAgentDocumentAsAdmin, deleteAgentDocumentAsAdmin } from './agents.actions';
import type { AgentDocumentType } from '@/types/database.types';

// Redesign 2026-09 (follow-up) — Agent verification detail screen. Plot:
// "Driving License and Second Government ID filed should allow to upload
// multiple files as user needs to send front side as well as back side,
// so multi files should be allowed ... for Admin and reviwer when
// verifying it." The schema only ever distinguished two document TYPES
// (driving_license, secondary_id), not "front"/"back" as separate
// fields — rather than fabricating front/back columns the mock never
// showed either, agent_documents now simply allows any number of files
// per type (supabase/schema.sql dropped the old one-row-per-type unique
// constraint), so an agent — or admin, here — can attach as many photos
// per document as needed (front, back, a retake, etc).
export function AgentDocumentManager({
  agentId,
  docType,
  label,
  files,
}: {
  agentId: string;
  docType: AgentDocumentType;
  label: string;
  files: { id: string; uploadedAt: string; url: string | null }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('file', file);
      const result = await uploadAgentDocumentAsAdmin(agentId, docType, fd);
      if ('error' in result) setError(result.error ?? null);
      else router.refresh();
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  function handleDelete(documentId: string) {
    if (!window.confirm('Remove this file?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAgentDocumentAsAdmin(documentId, agentId);
      if ('error' in result) setError(result.error ?? null);
      else router.refresh();
    });
  }

  return (
    <div style={{ border: `1px solid ${files.length ? 'var(--color-divider)' : 'var(--color-accent)'}`, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: files.length ? 'var(--p-ink-soft)' : 'var(--p-alert)' }}>
          {files.length ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'Missing'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 9 }}>
        {files.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--color-surface)', padding: '7px 9px', fontSize: 11 }}>
            <span style={{ color: 'var(--p-ink-soft)' }}>{f.uploadedAt.slice(0, 10)}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: 11, padding: 0 }}>
                  View
                </a>
              )}
              <button type="button" onClick={() => handleDelete(f.id)} disabled={isPending} style={{ fontSize: 11, color: 'var(--p-alert)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {files.length === 0 && <div style={{ height: 60, background: 'var(--color-neutral-300)' }} />}
      </div>

      <label style={{ display: 'inline-flex', fontSize: 11, fontWeight: 600, color: 'var(--color-accent-700)', cursor: 'pointer', marginTop: 9 }}>
        {isPending ? 'Uploading…' : '+ Add file'}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,.pdf" style={{ display: 'none' }} disabled={isPending} onChange={handleFileChange} />
      </label>
      {error && <p style={{ fontSize: 10.5, color: 'var(--p-alert)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
