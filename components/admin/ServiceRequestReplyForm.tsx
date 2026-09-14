'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postServiceRequestMessage, closeServiceRequest } from '@/components/service-requests/service-requests.actions';

export function ServiceRequestReplyForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send(alsoClose: boolean) {
    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set('message', message);
      const result = await postServiceRequestMessage(requestId, formData);
      if (result && 'error' in result) {
        setError(result.error);
        return;
      }
      if (alsoClose) await closeServiceRequest(requestId);
      setMessage('');
      router.refresh();
    });
  }

  return (
    <div>
      <div className="field" style={{ marginTop: 18 }}>
        <label>Reply — sent verbatim on WhatsApp</label>
        <textarea className="input" style={{ minHeight: 96, resize: 'none', lineHeight: 1.5 }} placeholder="Answer the customer directly" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 6 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }} disabled={pending || !message.trim()} onClick={() => send(false)}>
          Send reply
        </button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 44, fontSize: 13.5, padding: '0 18px' }} disabled={pending || !message.trim()} onClick={() => send(true)}>
          Reply and close request
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 9 }}>The customer can also close the request themselves from their app.</p>
    </div>
  );
}
