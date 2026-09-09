'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postServiceRequestMessage, closeServiceRequest } from './service-requests.actions';

function profileDisplayName(p: any) {
  if (!p) return 'Unknown';
  const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
  return name || p.email || 'Unknown';
}

export function ServiceRequestThread({
  request,
  messages,
  attachmentUrls,
  isAdmin,
}: {
  request: any;
  messages: any[];
  attachmentUrls: Record<string, string | null>;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const router = useRouter();

  const isClosed = request.status === 'closed';

  function handleReply(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await postServiceRequestMessage(request.id, formData);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const result = await closeServiceRequest(request.id);
      if (result?.error) setError(result.error);
      else router.refresh();
      setClosing(false);
    });
  }

  return (
    <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h2>{request.subject}</h2>
        <span className={`status-pill ${isClosed ? 'rejected' : 'pending'}`}>
          {isClosed ? `Closed${request.closed_by ? ` by ${request.closed_by}` : ''}` : 'Open'}
        </span>
      </div>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        {isAdmin && `${profileDisplayName(request.profiles)} · `}
        {request.properties?.property_name ? `${request.properties.property_name} · ` : ''}
        Opened {request.created_at?.slice(0, 10)}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {messages.map((m: any) => (
          <div
            key={m.id}
            className="card"
            style={{
              alignSelf: m.sender_role === 'admin' ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              background: m.sender_role === 'admin' ? 'var(--color-bg-alt, #f5f5f7)' : '#fff',
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              {m.sender_role === 'admin' ? 'Plot360 Support' : 'You'} · {m.created_at?.slice(0, 16).replace('T', ' ')}
            </p>
            <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.message}</p>
            {(m.service_request_attachments ?? []).length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {m.service_request_attachments.map((a: any) =>
                  attachmentUrls[a.file_path] ? (
                    <a
                      key={a.id}
                      href={attachmentUrls[a.file_path]!}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, color: 'var(--color-accent)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '4px 10px' }}
                    >
                      📎 {a.file_path.split('/').pop()}
                    </a>
                  ) : null
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      {!isClosed && (
        <form action={handleReply} className="card" style={{ marginBottom: 16 }}>
          <label className="field-label">Reply</label>
          <textarea className="field-input" name="message" rows={3} required style={{ marginBottom: 12 }} />
          <label className="field-label">Attach files (optional)</label>
          <input className="field-input" type="file" name="attachments" multiple style={{ marginBottom: 12 }} />
          <button className="btn-primary" type="submit" disabled={isPending}>
            {isPending ? 'Sending…' : 'Send reply'}
          </button>
        </form>
      )}

      {!isClosed && (
        <>
          {!closing ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
              onClick={() => setClosing(true)}
            >
              Close {isAdmin ? 'Case' : 'Request'}
            </button>
          ) : (
            <div className="card section-alt" style={{ borderColor: 'var(--color-danger)', maxWidth: 420 }}>
              <p style={{ fontSize: 14, marginBottom: 12 }}>
                Close this {isAdmin ? 'case' : 'request'}? No further replies can be added afterward.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-primary" onClick={() => setClosing(false)}>Cancel</button>
                <button
                  type="button"
                  disabled={isPending}
                  style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-button)', padding: '10px 24px', cursor: 'pointer' }}
                  onClick={handleClose}
                >
                  {isPending ? 'Closing…' : `Yes, close ${isAdmin ? 'case' : 'request'}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
