'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { verifyAgent } from './review-decisions.actions';
import { requestAgentDocuments } from './agents.actions';
import { toggleAgentBan } from './agent-bans.actions';
import { RejectionDialog } from './RejectionDialog';
import { buildWhatsAppLink } from './whatsapp';

export function AgentVerificationActions({ agentId, agentName, banned }: { agentId: string; agentName: string; banned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '2px solid var(--color-divider)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }}
          disabled={pending || banned}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await verifyAgent(agentId);
              if ('error' in result) setError(result.error);
              else router.push('/admin/queue/agent-verification');
            })
          }
        >
          Verify agent
        </button>

        <RejectionDialog
          triggerLabel="Request missing documents"
          title="Request the missing documents"
          note="Pick what is missing. The agent gets this on WhatsApp and can reply with photos."
          recipientLabel="WhatsApp to the agent"
          placeholder="Sent verbatim to the agent"
          cta="Send request"
          reasons={['Driving licence photo is unreadable or missing', 'Second government ID is unreadable or missing', 'SRO name and number are not filled in', 'Mobile number could not be reached']}
          messagePrefix="Plot360: Before we can verify your agent account, we need one more thing. "
          messageSuffix=" Reply here with a photo and we will add it for you."
          onSubmit={async (reasonText) => {
            // Redesign 2026-09 (follow-up) — requestAgentDocuments only
            // logs the message; this builds the real wa.me link from the
            // phone/message it hands back so RejectionDialog can open it,
            // same as every other "actually send this" WhatsApp button.
            const result = await requestAgentDocuments(agentId, reasonText);
            if ('error' in result) return result;
            return { success: true, whatsappLink: buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message) };
          }}
        />

        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px', color: banned ? 'var(--color-text)' : 'var(--p-alert)' }}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const reason = banned ? undefined : window.prompt('Reason for disabling this agent (shown internally only):') || '';
              if (!banned && reason === null) return;
              const result = await toggleAgentBan(agentId, !banned, reason);
              if ('error' in result) setError(result.error);
              else router.refresh();
            })
          }
        >
          {banned ? 'Enable login' : 'Disable login'}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 9 }}>{error}</p>}
      <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 9 }}>
        {banned ? 'Enabling restores sign-in and puts them back into assignment suggestions.' : 'Disabling stops the agent signing in and removes them from assignment suggestions.'}
      </p>
    </div>
  );
}
