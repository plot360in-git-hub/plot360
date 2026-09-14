import { uploadMediaByToken, deleteMediaByToken, submitByToken } from './magic-link.actions';
import { AgentCaptureScreen } from './AgentCaptureScreen';

// Redesign 2026-09 — thin wrapper for the no-login magic-link capture
// route (/m/[token]). Mirrors AgentCapture.tsx but binds the token-based
// server actions instead of the authenticated ones. Old PublicUploadForm.tsx
// is kept intact but no longer wired at app/m/[token]/page.tsx.
export function PublicCapture({ token, job, property, media }: { token: string; job: any; property: any; media: any[] }) {
  const lat = property?.google_map_lat ?? null;
  const lng = property?.google_map_lng ?? null;

  return (
    <AgentCaptureScreen
      mode="magic"
      propertyName={property?.property_name ?? 'Property'}
      address={[property?.street_address, property?.village_town, property?.district, property?.state].filter(Boolean).join(', ')}
      sro={property?.sro_name || property?.sro_code ? [property?.sro_name, property?.sro_code].filter(Boolean).join(' ') : null}
      pin={property?.plot_gps_coordinate || (lat && lng ? `${lat}, ${lng}` : null)}
      mapLink={lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null}
      propertyLat={lat}
      propertyLng={lng}
      visitLabel={job.visit_number ? `Visit ${job.visit_number}` : 'Site visit'}
      job={job}
      media={media}
      onUpload={uploadMediaByToken.bind(null, token)}
      onDelete={deleteMediaByToken.bind(null, token)}
      onSubmit={submitByToken.bind(null, token)}
    />
  );
}
