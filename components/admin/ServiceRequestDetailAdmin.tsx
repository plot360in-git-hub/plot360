import Link from 'next/link';
import { getServiceRequestDetail, getServiceRequestFileUrl } from '@/components/service-requests/service-requests.actions';
import { profileDisplayName } from './displayName';
import { hoursSince, formatWait } from '@/lib/adminQueue';
import { ServiceRequestReplyForm } from './ServiceRequestReplyForm';

// Redesign 2026-09 — admin console, Service request detail screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). A new,
// admin-only view built on the same actions the existing
// ServiceRequestThread.tsx uses (getServiceRequestDetail,
// postServiceRequestMessage, closeServiceRequest) — that component is
// left untouched since the CUSTOMER-facing /service-requests/[id] route
// still renders it.
export async function ServiceRequestDetailAdmin({ requestId }: { requestId: string }) {
  const { request, messages } = await getServiceRequestDetail(requestId);
  if (!request) return <p style={{ padding: 24 }}>Request not found.</p>;

  const attachmentUrls: Record<string, string | null> = {};
  for (const m of messages as any[]) {
    for (const a of m.service_request_attachments ?? []) {
      attachmentUrls[a.file_path] = await getServiceRequestFileUrl(a.file_path);
    }
  }

  const customer: any = request.profiles;
  const property: any = request.properties;
  const waitHours = hoursSince(request.updated_at);

  return (
    <div style={{ padding: '22px 26px 30px', maxWidth: 760 }}>
      <Link href="/admin/queue/service-requests" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
        ← Back to queue
      </Link>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>{request.subject}</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
        {profileDisplayName(customer)}
        {property?.property_name ? ` · ${property.property_name}` : ''} · raised {request.created_at?.slice(0, 10)} · waiting {formatWait(waitHours)}
        {request.status === 'closed' ? ' · closed' : ''}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(messages as any[]).map((m) => (
          <div key={m.id} style={{ background: m.sender_role === 'admin' ? 'transparent' : 'var(--color-surface)', padding: '15px 16px', border: m.sender_role === 'admin' ? '1px solid var(--color-divider)' : 'none' }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>
              {m.sender_role === 'admin' ? 'Plot360' : profileDisplayName(customer)} · {m.created_at?.slice(0, 16).replace('T', ' ')}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>{m.message}</div>
            {(m.service_request_attachments ?? []).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12 }}>
                {attachmentUrls[a.file_path] ? (
                  <a href={attachmentUrls[a.file_path]!} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 11, minHeight: 28 }}>
                    View attachment
                  </a>
                ) : (
                  <span style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>Attachment</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {request.status !== 'closed' ? (
        <ServiceRequestReplyForm requestId={requestId} />
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 18 }}>This request is closed.</p>
      )}
    </div>
  );
}
