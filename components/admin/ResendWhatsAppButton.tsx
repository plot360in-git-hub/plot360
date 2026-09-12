'use client';

import { useState, useTransition } from 'react';
import { getAssignmentWhatsAppDetails, getRejectionWhatsAppDetails } from './monitoring.actions';
import { buildWhatsAppLink, buildAssignmentMessage, buildRejectionMessage } from './whatsapp';

export function ResendWhatsAppButton({ jobId, status }: { jobId: string; status?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isRejected = status === 'rejected';

  function handleClick() {
    setError(null);
    startTransition(async () => {
      if (isRejected) {
        const details = await getRejectionWhatsAppDetails(jobId);
        if ('error' in details) {
          setError(details.error ?? 'Something went wrong.');
          return;
        }
        const message = buildRejectionMessage({
          propertyName: details.propertyName!,
          feedback: details.feedback!,
          uploadLink: details.uploadLink!,
        });
        window.open(buildWhatsAppLink(details.phoneCountryCode, details.phoneNumber, message), '_blank');
        return;
      }

      const details = await getAssignmentWhatsAppDetails(jobId);
      if ('error' in details) {
        setError(details.error ?? 'Something went wrong.');
        return;
      }
      const p = details.property!;
      const address = [p.street_address, p.village_town, p.district, p.state].filter(Boolean).join(', ');
      const mapUrl = p.google_map_lat && p.google_map_lng ? `https://www.google.com/maps?q=${p.google_map_lat},${p.google_map_lng}` : null;
      const message = buildAssignmentMessage({
        propertyName: p.property_name,
        plotSize: `${p.plot_size ?? ''} ${p.plot_size_unit ?? ''}`.trim(),
        address,
        mapUrl,
        gpsCoordinate: p.plot_gps_coordinate,
        nearbyLandmark: p.near_by_landmark,
        uploadLink: details.uploadLink!,
      });
      const link = buildWhatsAppLink(details.phoneCountryCode, details.phoneNumber, message);
      window.open(link, '_blank');
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="btn-primary"
        style={{ padding: '6px 16px', fontSize: 13 }}
      >
        {isPending ? 'Preparing…' : isRejected ? 'Resend rejection WhatsApp' : 'Resend WhatsApp'}
      </button>
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
