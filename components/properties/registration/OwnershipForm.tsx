'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveOwnership } from './registration.actions';
import type { PropertyOwnership } from '@/types/database.types';

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

function DownloadTemplateLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--color-accent)', marginLeft: 8 }}>
      (download template)
    </a>
  );
}

function OwnershipDocsUpload({
  intro,
  hasExisting,
}: {
  intro: string;
  hasExisting?: { noc: ExistingDoc; approval: ExistingDoc; ownerId: ExistingDoc };
}) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 18, marginBottom: 8 }}>Authorize verification</h3>
      <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--color-text-muted)' }}>{intro}</p>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">
          Approval letter<Required />
          <DownloadTemplateLink href="/documents/approval-letter-template.pdf" />
        </label>
        <input className="field-input" type="file" name="approval_letter" accept="image/*,.pdf" required={!hasExisting?.approval} />
        <ExistingDocLink doc={hasExisting?.approval ?? null} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">
          NOC letter<Required />
          <DownloadTemplateLink href="/documents/noc-template.pdf" />
        </label>
        <input className="field-input" type="file" name="noc_file" accept="image/*,.pdf" required={!hasExisting?.noc} />
        <ExistingDocLink doc={hasExisting?.noc ?? null} />
      </div>
      <div>
        <label className="field-label">Owner ID proof<Required /></label>
        <input className="field-input" type="file" name="owner_id_proof" accept="image/*,.pdf" required={!hasExisting?.ownerId} />
        <ExistingDocLink doc={hasExisting?.ownerId ?? null} />
      </div>
    </div>
  );
}

export function OwnershipForm({
  propertyId,
  initialData,
  hasExisting,
  backHref,
  redirectTo,
}: {
  propertyId: string;
  initialData?: Partial<PropertyOwnership>;
  hasExisting?: { noc: ExistingDoc; approval: ExistingDoc; ownerId: ExistingDoc };
  backHref?: string;
  redirectTo?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<'yes' | 'no' | ''>(
    initialData?.is_registered_user_owner === true ? 'yes' : initialData?.is_registered_user_owner === false ? 'no' : ''
  );
  const [agentEntry, setAgentEntry] = useState<'yes' | 'no' | ''>(
    initialData?.agent_entry_allowed === true ? 'yes' : initialData?.agent_entry_allowed === false ? 'no' : ''
  );
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveOwnership(propertyId, formData, redirectTo);
      if (result?.error) setError(result.error);
    });
  }

  const blockedByAgentEntry = isOwner === 'yes' && agentEntry === 'no';

  return (
    <form action={handleSubmit} style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Proofs of Ownership</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 15.5, marginBottom: 28 }}>
        Tell us who owns this plot, and authorize a Plot360 agent to verify it in person.
      </p>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 18, marginBottom: 16 }}>Owner details</h3>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Owner Name<Required /></label>
          <input className="field-input" name="owner_full_name" required defaultValue={initialData?.owner_full_name ?? ''} />
        </div>

        <div style={{ marginBottom: isOwner === 'yes' ? 16 : 0 }}>
          <label className="field-label">Is this plot owned by you?<Required /></label>
          <select
            className="field-input"
            name="is_owner"
            required
            value={isOwner}
            onChange={(e) => setIsOwner(e.target.value as 'yes' | 'no')}
          >
            <option value="" disabled>Select…</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        {isOwner === 'yes' && (
          <div>
            <label className="field-label">Do you allow our agent to enter this property to take photos/video?<Required /></label>
            <select
              className="field-input"
              name="agent_entry_allowed"
              required
              value={agentEntry}
              onChange={(e) => setAgentEntry(e.target.value as 'yes' | 'no')}
            >
              <option value="" disabled>Select…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        )}
      </div>

      {blockedByAgentEntry && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--color-danger)' }}>
          <p style={{ fontSize: 14 }}>
            Without allowing our agent to visit and photograph the property, we can't verify how
            secure the plot is, its current condition, or confirm the details you've provided.
            Registration can't continue past this step unless agent access is allowed — please
            change your answer above to "Yes" to proceed, or contact support if you'd like to
            discuss other verification options.
          </p>
        </div>
      )}

      {isOwner === 'yes' && !blockedByAgentEntry && (
        <OwnershipDocsUpload
          intro="Please provide an approval letter, NOC letter, and the owner's signed ID proof."
          hasExisting={hasExisting}
        />
      )}

      {isOwner === 'no' && (
        <OwnershipDocsUpload
          intro="Since the plot owner is different from the registering user, please provide an approval letter, NOC letter, and the owner's signed ID proof."
          hasExisting={hasExisting}
        />
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-primary" onClick={() => router.push(backHref || `/properties/${propertyId}/edit`)}>
          Back
        </button>
        <button className="btn-primary" type="submit" disabled={isPending || blockedByAgentEntry}>
          {isPending ? 'Saving…' : 'Continue to Documents'}
        </button>
      </div>
    </form>
  );
}
