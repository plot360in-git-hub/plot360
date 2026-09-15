'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createServiceRequest, getMyPropertiesForServiceRequest, closeServiceRequest, getMyServiceRequests } from './service-requests.actions';

type OpenRequest = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

// Redesign 2026-09 (follow-up) — this screen was explicitly left
// untouched in the original customer-app phase ("already functional; not
// part of this pass" — ARCHITECTURE.md §9), which was disclosed at the
// time, unlike some of the other gaps found since. Plot has now asked for
// it, with the mock attached: design_handoff_plot360_redesign, "Plot360
// Customer.dc.html", "Service request" screen. One combined screen (new
// request form + open requests list), matching the mock — replacing the
// old two-route split (a plain list page + a separate "new request" form
// page). Both app/service-requests/page.tsx and app/service-requests/
// new/page.tsx now render this; NewServiceRequestForm.tsx is untouched
// and unused, same pattern as the rest of this redesign.
//
// Two deviations from the literal mock:
//  - "Related property" is a real <select> of the customer's own
//    properties, not the mock's free-text input (its placeholder,
//    "Tukkuguda North", is just example text) — property_id has to
//    reference a real property, so a free-text field would break the
//    actual relationship.
//  - The list below is filtered to non-closed requests only, matching
//    the mock's "Open requests" heading exactly — a closed request is
//    still reachable at its own /service-requests/[id] URL (e.g. from
//    its own email notification), just not listed here anymore. The old
//    page listed every request regardless of status; this narrows that.
export function ServiceRequestScreen() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [properties, setProperties] = useState<{ id: string; property_name: string }[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getMyPropertiesForServiceRequest().then((rows) => {
      if (!cancelled) setProperties(rows);
    });
    getMyServiceRequests().then((rows) => {
      if (!cancelled) setOpenRequests((rows as OpenRequest[]).filter((r) => r.status !== 'closed'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set('subject', text.slice(0, 80) || 'Service request');
    formData.set('description', text);
    startTransition(async () => {
      const result = await createServiceRequest(formData);
      if (result?.error) setError(result.error);
      else if (result?.requestId) router.push(`/service-requests/${result.requestId}`);
    });
  }

  function handleClose(requestId: string) {
    setClosingId(requestId);
    startTransition(async () => {
      const result = await closeServiceRequest(requestId);
      if (!result?.error) setOpenRequests((rows) => rows.filter((r) => r.id !== requestId));
      setClosingId(null);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <Link href="/dashboard" className="btn btn-secondary" style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }} aria-label="Back to dashboard">
          ←
        </Link>
        <h1 style={{ fontSize: 17 }}>Service request</h1>
      </div>

      <form action={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 60px' }}>
        <h2 style={{ fontSize: 22, lineHeight: 1.12 }}>Tell us what you need</h2>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 7 }}>
          Anything at all — a concern about the land, a question about a report, a service you could not find. A
          representative replies on WhatsApp.
        </p>

        <div className="field" style={{ marginTop: 18 }}>
          <label>Your request</label>
          <textarea
            className="input"
            style={{ minHeight: 130, resize: 'none', lineHeight: 1.5 }}
            placeholder="Type here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </div>

        <div style={{ border: '1px dashed var(--color-divider)', padding: 16, marginTop: 6 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Attach a document or picture</div>
          <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 3 }}>
            {fileName ?? 'PDF, JPG or PNG · optional'}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            name="attachments"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 40, fontSize: 12.5, marginTop: 10, background: 'var(--color-bg)' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose file
          </button>
        </div>

        {properties.length > 0 && (
          <div className="field" style={{ marginTop: 14 }}>
            <label>
              Related property <span className="text-muted">(optional)</span>
            </label>
            <select className="input" name="property_id" defaultValue="">
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.property_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p style={{ color: 'var(--p-alert)', marginTop: 12, fontSize: 13.5 }}>{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={isPending || !text.trim()} style={{ minHeight: 48, fontSize: 14, marginTop: 16 }}>
          {isPending ? 'Sending…' : 'Send request'}
        </button>

        <div style={{ height: 2, background: 'var(--color-divider)', margin: '22px 0 16px' }} />

        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)' }}>Open requests</div>
        {openRequests.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 10 }}>No open requests.</p>}
        {openRequests.map((r) => (
          <div key={r.id} style={{ borderTop: '1px solid var(--color-divider)', marginTop: 10, padding: '12px 0', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, background: 'var(--color-accent)', flex: 'none', marginTop: 6 }} />
            <Link href={`/service-requests/${r.id}`} className="nav-link" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{r.subject}</div>
              <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', lineHeight: 1.45, marginTop: 2 }}>
                Raised {r.created_at?.slice(0, 10)} · Updated {r.updated_at?.slice(0, 10)}
              </div>
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11.5 }}
              disabled={isPending && closingId === r.id}
              onClick={() => handleClose(r.id)}
            >
              {closingId === r.id ? 'Closing…' : 'Close'}
            </button>
          </div>
        ))}
      </form>
    </div>
  );
}
