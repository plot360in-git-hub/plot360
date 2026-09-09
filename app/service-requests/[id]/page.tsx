import { getServiceRequestDetail, getServiceRequestFileUrl } from '@/components/service-requests/service-requests.actions';
import { ServiceRequestThread } from '@/components/service-requests/ServiceRequestThread';

export default async function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { request, messages } = await getServiceRequestDetail(id);
  if (!request) return <p>Request not found.</p>;

  const attachmentUrls: Record<string, string | null> = {};
  for (const m of messages) {
    for (const a of m.service_request_attachments ?? []) {
      attachmentUrls[a.file_path] = await getServiceRequestFileUrl(a.file_path);
    }
  }

  return <ServiceRequestThread request={request} messages={messages} attachmentUrls={attachmentUrls} isAdmin={false} />;
}
