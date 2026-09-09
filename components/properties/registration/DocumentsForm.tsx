'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDocumentsAndSubmit } from './registration.actions';
import type { PropertyOwnership } from '@/types/database.types';

const SRO_HELP_URL = 'https://registration.telangana.gov.in/jusrisdictionSro.htm';

function Required() {
  return <span style={{ color: 'var(--color-danger)' }}> *</span>;
}

type ExistingDoc = { name: string; url: string | null } | null;

function ExistingDocLink({ doc }: { doc: ExistingDoc }) {
  if (!doc) return null;
  return (
    <p style={{ fontSize: 13, marginTop: 6 }}>
      Currently uploaded:{' '}
      {doc.url ? (
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
          {doc.name}
        </a>
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>{doc.name}</span>
      )}
      {' — '}
      <span style={{ color: 'var(--color-text-muted)' }}>choose a file below only to replace it</span>
    </p>
  );
}

export function DocumentsForm({
  propertyId,
  existingTitleDeedDocs,
  existingEcReferenceCopy,
  initialOwnership,
  backHref,
  cancelHref,
  redirectTo,
}: {
  propertyId: string;
  existingTitleDeedDocs?: ExistingDoc[];
  existingEcReferenceCopy?: ExistingDoc;
  initialOwnership?: Partial<PropertyOwnership>;
  backHref?: string;
  cancelHref?: string;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wantsDigitalEc, setWantsDigitalEc] = useState<'yes' | 'no' | ''>(
    initialOwnership?.ec_digital_copy_requested === true
      ? 'yes'
      : initialOwnership?.ec_digital_copy_requested === false
      ? 'no'
      : ''
  );
  const router = useRouter();
  const hasTitleDeed = (existingTitleDeedDocs ?? []).length > 0;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveDocumentsAndSubmit(propertyId, formData, redirectTo);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Ownership Documents</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 15.5, marginBottom: 28 }}>
        Last step — upload the title deed and confirm a couple of declarations.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Title deed</h3>
        <div>
          <label className="field-label">
            Property Title / Sale Deed (make sure first page or last page where owner name, property
            details clearly state property &amp; the owner details match)<Required />
          </label>
          <input className="field-input" type="file" name="title_deed" accept="image/*,.pdf" multiple required={!hasTitleDeed} />
          {(existingTitleDeedDocs ?? []).map((doc) => (
            <p key={doc?.name} style={{ fontSize: 13, marginTop: 6 }}>
              Uploaded:{' '}
              {doc?.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{doc.name}</a>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>{doc?.name}</span>
              )}
            </p>
          ))}
          {hasTitleDeed && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Choosing files above adds them alongside what's already uploaded — it doesn't replace them.
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Encumbrance Certificate</h3>
        <div style={{ marginBottom: wantsDigitalEc === 'yes' ? 16 : 0 }}>
          <label className="field-label">
            Do you want a Digital Signed Certified copy of EC (Encumbrance Certificate)?<Required />
          </label>
          <select
            className="field-input"
            name="ec_digital_copy_requested"
            required
            value={wantsDigitalEc}
            onChange={(e) => setWantsDigitalEc(e.target.value as 'yes' | 'no')}
          >
            <option value="" disabled>Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {wantsDigitalEc === 'yes' && (
          <div className="section-alt" style={{ borderRadius: 'var(--radius-input)', padding: 16, marginTop: 4 }}>
            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Document Number<Required /></label>
              <input className="field-input" name="ec_document_number" required defaultValue={initialOwnership?.ec_document_number ?? ''} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="field-label">Year of Registration<Required /></label>
                <input className="field-input" name="ec_registration_year" required defaultValue={initialOwnership?.ec_registration_year ?? ''} />
              </div>
              <div>
                <label className="field-label">Registered at SRO<Required /></label>
                <input className="field-input" name="ec_registered_sro" required defaultValue={initialOwnership?.ec_registered_sro ?? ''} />
              </div>
            </div>
            <div>
              <label className="field-label">Upload old EC or front page of Sale Deed where document number is visible</label>
              <input className="field-input" type="file" name="ec_reference_copy" accept="image/*,.pdf" />
              <ExistingDocLink doc={existingEcReferenceCopy ?? null} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>
              Please find these details in your sale deed, or search the government site:{' '}
              <a href={SRO_HELP_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
                Find SRO
              </a>
            </p>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Declarations</h3>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12, fontSize: 14 }}>
          <input type="checkbox" name="no_legal_case" required />
          No legal / criminal case or issue exists on this plot<Required />
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16, fontSize: 14 }}>
          <input type="checkbox" name="agent_entry_terms" required />
          You approve Plot360 to enter and take pictures/videos<Required />
        </label>

        <div>
          <label className="field-label">Any other terms / conditions</label>
          <textarea className="field-input" name="other_terms" rows={2} />
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => router.push(backHref || `/properties/${propertyId}/ownership`)}
        >
          Back
        </button>
        <button type="button" className="btn-primary" onClick={() => router.push(cancelHref || '/dashboard')}>
          Cancel
        </button>
        <button className="btn-primary" type="submit" disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
