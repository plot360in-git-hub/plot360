import { getJobDetail, getMediaUrl } from '@/components/agent/agent-jobs.actions';
import { AgentJobDetail } from '@/components/agent/AgentJobDetail';

export default async function AgentJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { job, media } = await getJobDetail(id);
  if (!job) return <p className="container-narrow">Job not found.</p>;

  const mediaWithUrls = await Promise.all(
    media.map(async (m) => ({ ...m, url: await getMediaUrl(m.file_path) }))
  );

  return <AgentJobDetail job={job} media={mediaWithUrls} />;
}
