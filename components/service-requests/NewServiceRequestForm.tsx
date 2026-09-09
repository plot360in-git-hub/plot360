'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createServiceRequest, getMyPropertiesForServiceRequest } from './service-requests.actions';

export function NewServiceRequestForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<{ id: string; property_name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    getMyPropertiesForServiceRequest().then(setProperties);
  }, []);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createServiceRequest(formData);
      if (result?.error) setError(result.error);
      else router.push(`/service-requests/${result.requestId}`);
    });
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24 }}>New Service Request</h2>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Subject<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <input className="field-input" name="subject" required />
      </div>

      {properties.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Related property (optional)</label>
          <select className="field-input" name="property_id" defaultValue="">
            <option value="">None</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.property_name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Describe your issue or request<span style={{ color: 'var(--color-danger)' }}> *</span></label>
        <textarea className="field-input" name="description" rows={5} required />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label className="field-label">Attach files (optional)</label>
        <input className="field-input" type="file" name="attachments" multiple />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
