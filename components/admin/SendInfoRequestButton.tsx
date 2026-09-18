'use client';

import { useState, useTransition } from 'react';
import { sendAdditionalInfoRequest } from './review-decisions.actions';
import { buildWhatsAppLink } from './whatsapp';

// Redesign 2026-09 (follow-up) — Property verification detail screen.
// Same shape as ResendWhatsAppButton.tsx: a server action logs the
// message to the WhatsApp outbox, then this opens the real wa.me link so
// the admin can tap Send inside WhatsApp themselves.
export function SendInfoRequestButton({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await sendAdditionalInfoRequest(propertyId);
      if ('error' in result) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      window.open(buildWhatsAppLink(result.phoneCountryCode, result.phoneNumber, result.message), '_blank');
      setSent(true);
    });
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={handleClick} disabled={isPending} className="btn btn-secondary" style={{ minHeight: 36, fontSize: 12, padding: '0 14px' }}>
        {isPending ? 'Preparing…' : sent ? 'Sent — send again' : 'Request more info (WhatsApp)'}
      </button>
      {error && <p style={{ color: 'var(--p-alert)', fontSize: 11, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
