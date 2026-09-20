'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignAgentToTarget } from './assignment.actions';
import { buildWhatsAppLink } from './whatsapp';

// Redesign 2026-09 (follow-up) — Plot: "check ... any other place where
// whatsapp is not opening and just logging internally ... and fix it."
// assignAgentToTarget logged the new-job WhatsApp and this button routed
// straight to the queue — nothing ever opened WhatsApp for the admin to
// send it. Now shows a "Send via WhatsApp / Done" panel first, same
// shape AssignAgentForm.tsx/ReassignAgentForm.tsx already use for the
// "legacy" assignment flow.
export function AssignAgentButtons({
  kind,
  targetId,
  agentId,
  label,
  primary,
}: {
  kind: 'legacy' | 'visit_request' | 'stuck';
  targetId: string;
  agentId: string;
  label: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);

  if (waLink) {
    return (
      <div style={{ flex: 'none' }}>
        <p style={{ fontSize: 11, color: 'var(--color-success)', marginBottom: 6 }}>Assigned ✓</p>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{ minHeight: 30, fontSize: 11, padding: '0 11px', textDecoration: 'none', display: 'inline-flex', marginRight: 6 }}
        >
          Send via WhatsApp
        </a>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11, padding: '0 11px' }} onClick={() => router.push('/admin/queue/job-assignment')}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 'none' }}>
      <button
        type="button"
        className={primary ? 'btn btn-primary' : 'btn btn-secondary'}
        style={{ minHeight: primary ? 32 : 30, fontSize: primary ? 11.5 : 11, padding: primary ? '0 12px' : '0 11px' }}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await assignAgentToTarget(kind, targetId, agentId);
            if ('error' in result) setError(result.error ?? null);
            else if ('phoneNumber' in result && result.phoneNumber) setWaLink(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message ?? ''));
            else router.push('/admin/queue/job-assignment');
          })
        }
      >
        {pending ? 'Assigning…' : label}
      </button>
      {error && <p style={{ fontSize: 10.5, color: 'var(--p-alert)', marginTop: 4, maxWidth: 200 }}>{error}</p>}
    </div>
  );
}
