'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProperty, updateProperty } from './registration.actions';
import type { Property } from '@/types/database.types';

const CORNERS: Array<{ key: 'ne' | 'se' | 'nw' | 'sw'; label: string; sampleLat: string; sampleLng: string }> = [
  { key: 'ne', label: 'North East', sampleLat: '17.412800', sampleLng: '78.492700' },
  { key: 'se', label: 'South East', sampleLat: '17.412500', sampleLng: '78.493100' },
  { key: 'nw', label: 'North West', sampleLat: '17.413100', sampleLng: '78.492400' },
  { key: 'sw', label: 'South West', sampleLat: '17.412700', sampleLng: '78.492300' },
];

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';
const GPS_HELP_URL = 'https://support.google.com/maps/answer/18539';
const MAP_PIN_HELP_URL = 'https://support.google.com/maps/answer/144361';

function Required() {
  return <span style={{ color: 'var(--color-danger)' }}> *</span>;
}

export function PlotDetailsForm({
  mode = 'create',
  propertyId,
  initialData,
  redirectTo,
}: {
  mode?: 'create' | 'edit';
  propertyId?: string;
  initialData?: Partial<Property>;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === 'edit' && propertyId
          ? await updateProperty(propertyId, formData, redirectTo)
          : await createProperty(formData);
      if (result?.error) setError(result.error);
    });
  }

  const corners = (initialData?.gps_corners ?? {}) as Record<string, { lat?: number; lng?: number } | undefined>;

  return (
    <form action={handleSubmit} style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>{mode === 'edit' ? 'Edit Property Details' : 'Register a new property'}</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 15.5, marginBottom: 28 }}>
        Add your plot&rsquo;s details, then continue on to ownership proof and documents.
      </p>

      {/* Basic details */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Basic details</h3>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Property Name<Required /></label>
          <input className="field-input" name="property_name" required defaultValue={initialData?.property_name} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="field-label">Property Type<Required /></label>
            <select className="field-input" name="property_type" required defaultValue={initialData?.property_type || 'residential'}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="agricultural">Agricultural</option>
              <option value="industrial">Industrial</option>
            </select>
          </div>
          <div>
            <label className="field-label">Plot Shape</label>
            <select className="field-input" name="plot_shape" defaultValue={initialData?.plot_shape || ''}>
              <option value="" disabled>Select…</option>
              <option value="square">Square</option>
              <option value="rectangular">Rectangular</option>
              <option value="irregular">Irregular shape</option>
              <option value="l_shape">L-shape</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Plot Size (yards)<Required /></label>
          <input className="field-input" type="number" name="plot_size" min="0" step="0.01" required defaultValue={initialData?.plot_size ?? undefined} />
        </div>

        <div>
          <label className="field-label">Property Description</label>
          <textarea className="field-input" name="description" rows={3} placeholder="Notable features, description…" defaultValue={initialData?.description ?? ''} />
        </div>
      </div>

      {/* Plot address */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Plot address</h3>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Street Address</label>
          <input className="field-input" name="street_address" defaultValue={initialData?.street_address ?? ''} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="field-label">Local Area</label>
            <input className="field-input" name="local_area" defaultValue={initialData?.local_area ?? ''} />
          </div>
          <div>
            <label className="field-label">City / Town / Village<Required /></label>
            <input className="field-input" name="village_town" required defaultValue={initialData?.village_town ?? ''} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="field-label">Mandal / Taluka<Required /></label>
            <input className="field-input" name="mandal_taluka" required defaultValue={initialData?.mandal_taluka ?? ''} />
          </div>
          <div>
            <label className="field-label">District<Required /></label>
            <input className="field-input" name="district" required defaultValue={initialData?.district ?? ''} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label className="field-label">State<Required /></label>
            <input className="field-input" name="state" required defaultValue={initialData?.state ?? ''} />
          </div>
          <div>
            <label className="field-label">Postcode</label>
            <input className="field-input" type="number" inputMode="numeric" name="postal_code" defaultValue={initialData?.postal_code ?? ''} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
          <div>
            <label className="field-label">SRO Name<Required /></label>
            <input className="field-input" name="sro_name" required defaultValue={initialData?.sro_name ?? ''} />
          </div>
          <div>
            <label className="field-label">SRO Code<Required /></label>
            <input className="field-input" name="sro_code" required defaultValue={initialData?.sro_code ?? ''} />
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Please find these details in your sale deed, or search the government site:{' '}
          <a href={SRO_HELP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
            Find SRO
          </a>
        </p>
      </div>

      {/* GPS coordinates */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h3 style={{ fontSize: 18 }}>GPS Coordinates</h3>
          <a href={GPS_HELP_URL} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--color-accent)' }}>
            How do I find this?
          </a>
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          Corner coordinates of the plot (NE / SE / NW / SW) — optional, but helpful for precise mapping.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {CORNERS.map((c) => (
            <div key={c.key} className="section-alt" style={{ borderRadius: 'var(--radius-input)', padding: 16 }}>
              <p className="field-label" style={{ marginBottom: 8 }}>{c.label}</p>
              <div style={{ marginBottom: 8 }}>
                <input
                  className="field-input"
                  name={`${c.key}_lat`}
                  placeholder={`Latitude e.g. ${c.sampleLat}`}
                  defaultValue={corners[c.key]?.lat?.toString() ?? ''}
                />
              </div>
              <input
                className="field-input"
                name={`${c.key}_lng`}
                placeholder={`Longitude e.g. ${c.sampleLng}`}
                defaultValue={corners[c.key]?.lng?.toString() ?? ''}
              />
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Plot GPS Coordinate</label>
          <input
            className="field-input"
            name="plot_gps_coordinate"
            placeholder={`e.g. 40°42'45.9936"N, 74°0'21"W`}
            defaultValue={initialData?.plot_gps_coordinate ?? ''}
          />
        </div>

        <div>
          <label className="field-label">Nearby Landmark (e.g. school, hospital) or Google Map pin URL</label>
          <input className="field-input" name="near_by_landmark" defaultValue={initialData?.near_by_landmark ?? ''} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
            <a href={MAP_PIN_HELP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
              How do I find and copy a Google Maps pin link?
            </a>
          </p>
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {mode === 'edit' && (
          <button type="button" className="btn-primary" onClick={() => router.back()}>
            Back
          </button>
        )}
        {mode === 'create' && (
          <button type="button" className="btn-primary" onClick={() => router.push('/dashboard')}>
            Cancel
          </button>
        )}
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Continue to Ownership Proof'}
        </button>
      </div>
    </form>
  );
}
