'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reassignMonitoringJob, getAssignmentWhatsAppDetails } from './monitoring.actions';
import { buildWhatsAppLink, buildReassignmentMessage } from './whatsapp';

export function ReassignAgentForm({ jobId, agents, currentAgentId }: { jobId: string; agents: any[]; currentAgentId: string }) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const router = useRouter();

  const otherAgents = agents.filter((a) => a.id !== currentAgentId);

  function handleReassign() {
    if (!agentId) return;
    setError(null);
    startTransition(async () => {
      const result = await reassignMonitoringJob(jobId, agentId);
      if (result?.error) {
        setError(result.error);
        return;
      }

      const details = await getAssignmentWhatsAppDetails(jobId);
      if ('error' in details) {
        router.refresh();
        return;
      }
      const p = details.property!;
      const address = [p.street_address, p.village_town, p.district, p.state].filter(Boolean).join(', ');
      const mapUrl = p.google_map_lat && p.google_map_lng ? `https://www.google.com/maps?q=${p.google_map_lat},${p.google_map_lng}` : null;
      const message = buildReassignmentMessage({
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
        <p style={{ fontSize: 13, color: 'var(--color-success)', marginBottom: 8 }}>Reassigned ✓</p>
        <a href={waLink} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginRight: 8 }}>
          Send via WhatsApp
        </a>
        <button type="button" className="btn-secondary" onClick={() => router.refresh()}>
          Done
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setOpen(true)}>
        Reassign
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select className="field-input" value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ maxWidth: 200 }}>
        <option value="">Select new agent…</option>
        {otherAgents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.profiles?.first_name} {a.profiles?.last_name}
          </option>
        ))}
      </select>
      <button className="btn-primary" style={{ padding: '6px 16px', fontSize: 13 }} disabled={isPending || !agentId} onClick={handleReassign}>
        {isPending ? 'Reassigning…' : 'Confirm'}
      </button>
      <button type="button" className="btn-secondary" style={{ padding: '6px 16px', fontSize: 13 }} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}
