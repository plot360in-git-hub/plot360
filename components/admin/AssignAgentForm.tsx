'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignAgentToProperty, getAssignmentWhatsAppDetails } from './monitoring.actions';
import { buildWhatsAppLink, buildAssignmentMessage } from './whatsapp';

export function AssignAgentForm({ propertyId, agents }: { propertyId: string; agents: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState('');
  const [waLink, setWaLink] = useState<string | null>(null);
  const router = useRouter();

  function handleAssign() {
    if (!agentId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignAgentToProperty(propertyId, agentId);
      if (result?.error) {
        setError(result.error);
        return;
      }

      const details = await getAssignmentWhatsAppDetails(result.jobId!);
      if ('error' in details) {
        // Assignment succeeded even if the WhatsApp message prep failed —
        // don't block on it, just skip showing the send button.
        router.refresh();
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
      setWaLink(buildWhatsAppLink(details.phoneCountryCode, details.phoneNumber, message));
    });
  }

  if (waLink) {
    return (
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 13, color: 'var(--color-success)', marginBottom: 8 }}>Assigned ✓</p>
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ textDecoration: 'none', display: 'inline-block', marginRight: 8 }}
        >
          Send via WhatsApp
        </a>
        <button type="button" className="btn-secondary" onClick={() => router.refresh()}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select className="field-input" value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ maxWidth: 220 }}>
        <option value="">Select agent…</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.profiles?.first_name} {a.profiles?.last_name}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={isPending || !agentId} onClick={handleAssign}>
        {isPending ? 'Assigning…' : 'Assign'}
      </button>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</span>}
    </div>
  );
}
