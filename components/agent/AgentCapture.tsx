import { getJobDetail, getMediaUrl, createJobMediaUploadUrls, recordJobMedia, deleteJobMedia, submitJobWork } from './agent-jobs.actions';
import { AgentCaptureScreen } from './AgentCaptureScreen';

// Redesign 2026-09 — thin server wrapper for the authenticated agent
// capture route (/agent/jobs/[id]): fetches the job + media, binds the
// existing server actions to this job's id, and hands everything to the
// shared AgentCaptureScreen (also used by PublicCapture.tsx for the
// magic-link path). Old AgentJobDetail.tsx is kept intact but no longer
// wired at app/agent/jobs/[id]/page.tsx — see ARCHITECTURE.md.
export async function AgentCapture({ jobId }: { jobId: string }) {
  const { job, media } = await getJobDetail(jobId);
  if (!job) return <p className="p360" style={{ padding: 24 }}>Job not found.</p>;

  const mediaWithUrls = await Promise.all(media.map(async (m) => ({ ...m, url: await getMediaUrl(m.file_path) })));
  const property = job.properties;
  const lat = property?.google_map_lat ?? null;
  const lng = property?.google_map_lng ?? null;

  return (
    <AgentCaptureScreen
      mode="authenticated"
      propertyName={property?.property_name ?? 'Property'}
      address={[property?.street_address, property?.village_town, property?.district, property?.state].filter(Boolean).join(', ')}
      sro={property?.sro_name || property?.sro_code ? [property?.sro_name, property?.sro_code].filter(Boolean).join(' ') : null}
      pin={property?.plot_gps_coordinate || (lat && lng ? `${lat}, ${lng}` : null)}
      mapLink={lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null}
      propertyLat={lat}
      propertyLng={lng}
      visitLabel={[
        job.visit_number ? `Visit ${job.visit_number}` : 'Site visit',
        job.requested_window_start && job.requested_window_end
          ? `window ${job.requested_window_start.slice(5)}–${job.requested_window_end.slice(5)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      job={job}
      media={mediaWithUrls}
      onCreateUploadUrls={createJobMediaUploadUrls.bind(null, jobId)}
      onRecordMedia={recordJobMedia.bind(null, jobId)}
      onDelete={deleteJobMedia.bind(null, jobId)}
      onSubmit={submitJobWork.bind(null, jobId)}
      backHref="/agent/dashboard"
    />
  );
}
