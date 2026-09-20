'use client';

import { useState, useTransition } from 'react';
import { updatePropertyLocationFields } from './admin.actions';

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';

// Redesign 2026-09 (follow-up, round 17) — turns whatever the customer
// typed into the Google map pin field into something clickable: already
// a Maps link (goo.gl short link, full maps.google.com URL) → open it
// as-is; a raw coordinate pair or free-text landmark → hand it to Maps'
// generic search endpoint, which resolves either kind of input fine.
function buildMapsUrl(value?: string | null): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

// Redesign 2026-09 — admin console, Property verification detail
// screen's editable "Site location" fields — the quick registration
// flow leaves most of these blank for an admin to fill in while
// verifying (see admin.actions.ts, updatePropertyLocationFields).
export function LocationFieldsForm({ property }: { property: any }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Redesign 2026-09 (follow-up, round 17) — the Google-maps link needs
  // to react to what's typed, not just what was last saved, so this one
  // field is tracked in state (the rest stay uncontrolled/defaultValue —
  // no other field needs a live-updating link next to it).
  const [gpsValue, setGpsValue] = useState(property.plot_gps_coordinate ?? '');
  const mapsUrl = buildMapsUrl(gpsValue);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await updatePropertyLocationFields(property.id, formData);
          if (result && 'error' in result) setError(result.error ?? null);
          else {
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }
        })
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 11 }}>
        <div className="field">
          <label>Street address</label>
          <input className="input" style={{ minHeight: 38 }} name="street_address" defaultValue={property.street_address ?? ''} placeholder="Survey number, landmark" />
        </div>
        <div className="field">
          <label>Village / city</label>
          <input className="input" style={{ minHeight: 38 }} name="village_town" defaultValue={property.village_town ?? ''} />
        </div>
        <div className="field">
          <label>Mandal</label>
          <input className="input" style={{ minHeight: 38 }} name="mandal_taluka" defaultValue={property.mandal_taluka ?? ''} />
        </div>
        <div className="field">
          <label>
            SRO name and number{' '}
            <a href={SRO_HELP_URL} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
              Find SRO →
            </a>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ minHeight: 38 }} name="sro_name" defaultValue={property.sro_name ?? ''} placeholder="SRO name" />
            <input className="input" style={{ minHeight: 38, maxWidth: 90 }} name="sro_code" defaultValue={property.sro_code ?? ''} placeholder="Code" />
          </div>
        </div>
        <div className="field">
          <label>
            Google map pin{' '}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                Open in Google Maps →
              </a>
            )}
          </label>
          <input
            className="input"
            style={{ minHeight: 38 }}
            name="plot_gps_coordinate"
            value={gpsValue}
            onChange={(e) => setGpsValue(e.target.value)}
            placeholder="17.1766, 78.4429"
          />
        </div>
        <div className="field">
          <label>Site size in yards</label>
          <input className="input" style={{ minHeight: 38 }} name="plot_size" type="number" defaultValue={property.plot_size ?? ''} placeholder="Not given by customer" />
        </div>
      </div>
      {error && <p style={{ fontSize: 12, color: 'var(--p-alert)', marginTop: 8 }}>{error}</p>}
      <button type="submit" className="btn btn-secondary" style={{ minHeight: 34, fontSize: 12, marginTop: 10 }} disabled={pending}>
        {pending ? 'Saving…' : saved ? 'Saved ✓' : 'Save site location'}
      </button>
    </form>
  );
}
