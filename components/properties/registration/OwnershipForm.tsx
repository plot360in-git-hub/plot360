'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveOwnership } from './registration.actions';
import type { PropertyOwnership } from '@/types/database.types';
import type { ReusableOwnerIdProof } from './registration.actions';

// Redesign 2026-09 (follow-up, round 13) — full rebuild of the "Proofs of
// Ownership" screen (reached from admin property verification's "Edit
// ownership" link, and from the customer's own pre-verification edit
// flow) per Plot's exact spec, sent field by field:
//   1) Owner Name *
//   2) Is this plot owned by the user? * — Yes: reuse an owner ID proof
//      already on file for another property this same customer owns, or
//      upload one if none exists. No: owner ID proof (the actual
//      registered owner's) + NOC, only asked in this branch, with a
//      downloadable template.
//   3) Sale Deed: Property Title / Sale Deed upload (moved here from the
//      separate Documents step — see registration.actions.ts).
//   Save / Cancel buttons.
// Restyled to the `.p360` design system to match the rest of the
// redesigned app (this screen still used the pre-redesign `card`/
// `field-label` classes). Dropped entirely: the old "Approval letter"
// upload and the "do you allow our agent to enter" question — neither is
// in Plot's new field list, and agent-entry consent is already collected
// at property creation via RegisterQuick.tsx's terms checkbox.

function Required() {
  return <span style={{ color: 'var(--color-accent)' }}> *</span>;
}

type ExistingDoc = { name: string; url: string | null } | null;

function ExistingDocLink({ doc }: { doc: ExistingDoc }) {
  if (!doc) return null;
  return (
    <p style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 6 }}>
      Currently uploaded:{' '}
      {doc.url ? (
        <a href={doc.url} target="_blank" rel="noreferrer">
          {doc.name}
        </a>
      ) : (
        <span>{doc.name}</span>
      )}
      {' — choose a file below only to replace it.'}
    </p>
  );
}

function DownloadTemplateLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, marginLeft: 8 }}>
      (download template)
    </a>
  );
}

function YesNoToggle({
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
}: {
  value: 'yes' | 'no' | '';
  onChange: (v: 'yes' | 'no') => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div style={{ display: 'flex' }}>
      {(['yes', 'no'] as const).map((opt, i) => (
        <button
          key={opt}
          type="button"
          className="btn"
          style={{
            flex: 1,
            minHeight: 42,
            // Redesign 2026-09 (follow-up, round 16) — squaring off just
            // the touching corner (round 15) still left an inconsistent
            // divider for Plot — flex items butted edge-to-edge can be a
            // hair off by sub-pixel layout rounding, so a 0-width border
            // on one side isn't reliable. Standard segmented-control fix
            // instead: BOTH buttons keep a full border, and every button
            // after the first overlaps the previous one by exactly 1px
            // (marginLeft: -1) so the two borders land on the exact same
            // pixel — later DOM order paints on top, so there is always
            // one visible divider line, never a gap.
            marginLeft: i === 0 ? 0 : -1,
            border: '1px solid var(--color-divider)',
            borderRadius: i === 0 ? 'var(--radius-md) 0 0 var(--radius-md)' : '0 var(--radius-md) var(--radius-md) 0',
            background: value === opt ? 'var(--color-accent)' : 'transparent',
            color: value === opt ? 'var(--color-bg)' : 'var(--color-text)',
            fontSize: 12.5,
            justifyContent: 'center',
          }}
          onClick={() => onChange(opt)}
        >
          {opt === 'yes' ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  );
}

export function OwnershipForm({
  propertyId,
  initialData,
  hasExisting,
  existingTitleDeedDocs,
  reusableOwnerIdProof,
  backHref,
  redirectTo,
}: {
  propertyId: string;
  initialData?: Partial<PropertyOwnership>;
  hasExisting?: { noc: ExistingDoc; ownerId: ExistingDoc };
  existingTitleDeedDocs?: ExistingDoc[];
  reusableOwnerIdProof?: ReusableOwnerIdProof | null;
  backHref?: string;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<'yes' | 'no' | ''>(
    initialData?.is_registered_user_owner === true ? 'yes' : initialData?.is_registered_user_owner === false ? 'no' : ''
  );
  // Defaults to reusing the found proof (when one exists and this
  // property doesn't already have its own owner ID on file) — the whole
  // point of offering it is to save the customer an upload.
  const [ownerIdMode, setOwnerIdMode] = useState<'reuse' | 'new'>(
    reusableOwnerIdProof && !hasExisting?.ownerId ? 'reuse' : 'new'
  );
  const router = useRouter();

  const hasTitleDeed = (existingTitleDeedDocs ?? []).length > 0;

  function handleSubmit(formData: FormData) {
    setError(null);
    if (isOwner === 'yes' && ownerIdMode === 'reuse' && reusableOwnerIdProof) {
      formData.set('reuse_owner_id_from', reusableOwnerIdProof.filePath);
    }
    startTransition(async () => {
      const result = await saveOwnership(propertyId, formData, redirectTo);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="p360" style={{ minHeight: '80vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '2px solid var(--color-divider)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minWidth: 36, minHeight: 36, fontSize: 16, padding: 0, justifyContent: 'center' }}
          aria-label="Back"
          onClick={() => router.push(backHref || `/properties/${propertyId}/edit`)}
        >
          ←
        </button>
        <h1 style={{ fontSize: 17, flex: 1 }}>Edit ownership</h1>
      </div>

      <form action={handleSubmit} style={{ maxWidth: 560, margin: '0 auto', padding: '20px 20px 60px' }}>
        <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginBottom: 20 }}>
          Tell us who owns this plot, and provide proof of ownership.
        </p>

        {/* Section 1 — Owner name */}
        <div className="field">
          <label>
            Owner Name<Required />
          </label>
          <input className="input" name="owner_full_name" required defaultValue={initialData?.owner_full_name ?? ''} />
        </div>

        {/* Section 2 — Is this plot owned by the user? */}
        <div className="field" style={{ marginTop: 18 }}>
          <label>
            Is this plot owned by the user?<Required />
          </label>
          <input type="hidden" name="is_owner" value={isOwner} />
          <YesNoToggle value={isOwner} onChange={setIsOwner} />
        </div>

        {isOwner === 'yes' && (
          <div style={{ marginTop: 16 }}>
            {reusableOwnerIdProof && !hasExisting?.ownerId ? (
              <div className="card section-alt" style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12.5, marginBottom: 10 }}>
                  We already have an owner ID proof on file from <strong>{reusableOwnerIdProof.propertyName}</strong>, another
                  property this customer owns.
                </p>
                <div style={{ display: 'flex', marginBottom: ownerIdMode === 'new' ? 12 : 0 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      flex: 1,
                      minHeight: 38,
                      border: '1px solid var(--color-divider)',
                      borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                      background: ownerIdMode === 'reuse' ? 'var(--color-accent)' : 'transparent',
                      color: ownerIdMode === 'reuse' ? 'var(--color-bg)' : 'var(--color-text)',
                      fontSize: 12,
                      justifyContent: 'center',
                    }}
                    onClick={() => setOwnerIdMode('reuse')}
                  >
                    Use this proof
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      flex: 1,
                      minHeight: 38,
                      marginLeft: -1,
                      border: '1px solid var(--color-divider)',
                      borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                      background: ownerIdMode === 'new' ? 'var(--color-accent)' : 'transparent',
                      color: ownerIdMode === 'new' ? 'var(--color-bg)' : 'var(--color-text)',
                      fontSize: 12,
                      justifyContent: 'center',
                    }}
                    onClick={() => setOwnerIdMode('new')}
                  >
                    Upload a new one
                  </button>
                </div>
                {ownerIdMode === 'reuse' && reusableOwnerIdProof.url && (
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    <a href={reusableOwnerIdProof.url} target="_blank" rel="noreferrer">
                      View the proof we'll reuse
                    </a>
                  </p>
                )}
                {ownerIdMode === 'new' && (
                  <div className="field" style={{ marginTop: 0 }}>
                    <label>
                      Owner ID proof<Required />
                    </label>
                    <input className="input" type="file" name="owner_id_proof" accept="image/*,.pdf" required />
                  </div>
                )}
              </div>
            ) : (
              <div className="field">
                <label>
                  Owner ID proof<Required />
                </label>
                <input className="input" type="file" name="owner_id_proof" accept="image/*,.pdf" required={!hasExisting?.ownerId} />
                <ExistingDocLink doc={hasExisting?.ownerId ?? null} />
              </div>
            )}
          </div>
        )}

        {isOwner === 'no' && (
          <div style={{ marginTop: 16 }}>
            <div className="field">
              <label>
                Owner ID proof <span className="text-muted">(on which the plot is registered)</span>
                <Required />
              </label>
              <input className="input" type="file" name="owner_id_proof" accept="image/*,.pdf" required={!hasExisting?.ownerId} />
              <ExistingDocLink doc={hasExisting?.ownerId ?? null} />
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>
                NOC (No Objection Certificate)
                <DownloadTemplateLink href="/documents/noc-template.pdf" />
                <Required />
              </label>
              <input className="input" type="file" name="noc_file" accept="image/*,.pdf" required={!hasExisting?.noc} />
              <ExistingDocLink doc={hasExisting?.noc ?? null} />
            </div>
          </div>
        )}

        {/* Section 3 — Sale Deed */}
        <div style={{ height: 2, background: 'var(--color-divider)', margin: '22px 0 18px' }} />
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--p-ink-soft)', marginBottom: 10 }}>
          Sale deed
        </div>
        <div className="field">
          <label>
            Property Title / Sale Deed <span className="text-muted">(make sure the first or last page, where owner name and property details are clearly stated, matches the owner details)</span>
            <Required />
          </label>
          <input className="input" type="file" name="title_deed" accept="image/*,.pdf" multiple required={!hasTitleDeed} />
          {(existingTitleDeedDocs ?? []).map((doc) => (
            <p key={doc?.name} style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 6 }}>
              Uploaded:{' '}
              {doc?.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer">
                  {doc.name}
                </a>
              ) : (
                <span>{doc?.name}</span>
              )}
            </p>
          ))}
          {hasTitleDeed && (
            <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
              Choosing files above adds them alongside what's already uploaded — it doesn't replace them.
            </p>
          )}
        </div>

        {error && <p style={{ color: 'var(--p-alert)', marginTop: 16, fontSize: 13.5 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, minHeight: 46, fontSize: 14, justifyContent: 'center' }}
            onClick={() => router.push(backHref || `/properties/${propertyId}/edit`)}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={isPending || !isOwner}
            style={{ flex: 1, minHeight: 46, fontSize: 14, justifyContent: 'center' }}
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
