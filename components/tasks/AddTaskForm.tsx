'use client';

import { useState, useTransition } from 'react';
import { createTask } from './tasks.actions';

const TASK_TYPES = [
  { value: 'property_inspection', label: 'Property Inspection' },
  { value: 'secure_check', label: 'Secure Check' },
  { value: 'renewal', label: 'Renew Property Listing' },
  { value: 'other', label: 'Other' },
];

export function AddTaskForm({ propertyId }: { propertyId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTask(propertyId, formData);
      if (result?.error) setError(result.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)} style={{ marginBottom: 16 }}>
        + Add Task
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="card section-alt" style={{ marginBottom: 24 }}>
      <h4 style={{ marginBottom: 16 }}>New task</h4>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Task name</label>
        <input className="field-input" name="task_name" required placeholder="e.g. Property Inspection" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">Task type</label>
          <select className="field-input" name="task_type" defaultValue="">
            <option value="" disabled>Select…</option>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Start date</label>
          <input className="field-input" type="date" name="start_date" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Notes</label>
        <textarea className="field-input" name="notes" rows={2} />
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Adding…' : 'Add Task'}
        </button>
        <button className="btn-primary" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
