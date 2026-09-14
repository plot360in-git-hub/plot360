'use client';

import { useState, useTransition } from 'react';
import { resendWhatsAppMessage } from './whatsapp-log.actions';

// Redesign 2026-09 — admin console. Re-opens a wa.me link for a logged
// WhatsApp message and stamps resent_at/state back to 'sent'. There's
// no live send API to retry against (see whatsapp-log.actions.ts) — the
// "resend" is the same client-side wa.me reopen ResendWhatsAppButton.tsx
// already did, just now persisted.
export function ResendOutboxButton({ messageId }: { messageId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-secondary"
      style={{ minHeight: 32, fontSize: 11.5, flex: 'none' }}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resendWhatsAppMessage(messageId);
          if (result && 'success' in result && result.recipientPhone) {
            const digits = result.recipientPhone.replace(/[^\d]/g, '');
            window.open(`https://wa.me/${digits}?text=${encodeURIComponent(result.body)}`, '_blank');
          }
          setDone(true);
        })
      }
    >
      {done ? 'Resent' : pending ? 'Sending…' : 'Resend'}
    </button>
  );
}
