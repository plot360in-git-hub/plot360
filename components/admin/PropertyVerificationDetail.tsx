import Link from 'next/link';
import { getPropertyForReview, getDocumentSignedUrl } from './admin.actions';
import { getLatestPaymentForProperty } from '@/components/payments/payments.actions';
import { getLatestVisitCreditBatch } from '@/components/payments/visitCredits.actions';
import { TimelineOutboxPanel } from './TimelineOutboxPanel';
import { PropertyVerificationActions } from './PropertyVerificationActions';
import { LocationFieldsForm } from './LocationFieldsForm';
import { ExtendCreditsForm } from './ExtendCreditsForm';
import { DeletePropertyButton } from './DeletePropertyButton';
import { hoursSince, formatWait } from '@/lib/adminQueue';

// Redesign 2026-09 — admin console, Property verification detail screen
// (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"). Replaces
// AdminReview.tsx on /admin/[id] (kept intact, unreferenced — see
// ARCHITECTURE.md, which also notes the one deliberate simplification:
// document replace/"Upload from WhatsApp" and the ownership owned/not-
// owned toggle stay on the existing, fully-working /admin/[id]/ownership
// and /admin/[id]/documents edit routes rather than being rebuilt here,
// since the design's own mock treats those buttons as no-ops.
export async function PropertyVerificationDetail({ propertyId }: { propertyId: string }) {
  const [{ property, ownership, documents }, payment, creditBatch] = await Promise.all([
    getPropertyForReview(propertyId),
    getLatestPaymentForProperty(propertyId),
    getLatestVisitCreditBatch(propertyId),
  ]);

  if (!property) return <p style={{ padding: 24 }}>Property not found.</p>;

  const saleDeed = documents.find((d: any) => d.doc_type === 'title_deed');
  const idProofDoc = documents.find((d: any) => d.doc_type === 'owner_id');
  const approvalDoc = documents.find((d: any) => d.doc_type === 'approval_letter');
  const [saleDeedUrl, idProofUrl, approvalUrl] = await Promise.all([
    saleDeed ? getDocumentSignedUrl(saleDeed.file_path) : null,
    idProofDoc ? getDocumentSignedUrl(idProofDoc.file_path) : null,
    approvalDoc ? getDocumentSignedUrl(approvalDoc.file_path) : null,
  ]);

  const owner: any = property.profiles;
  const notOwned = ownership && ownership.is_registered_user_owner === false;
  const waitHours = hoursSince(property.created_at);
  const planNote = payment?.status === 'completed' ? `paid ₹${Number(payment.amount ?? 0).toLocaleString('en-IN')}` : payment ? 'payment pending' : 'no payment yet';

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, padding: '22px 24px 30px', overflowY: 'auto' }}>
        <Link href="/admin/queue/property-verification" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
          ← Back to queue
        </Link>
        <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>{property.property_name}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
          registered {property.created_at?.slice(0, 10)} · {planNote} · waiting {formatWait(waitHours)}
        </div>

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Site location</div>
        <LocationFieldsForm property={property} />

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 4 }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Ownership</div>
          <Link href={`/admin/${propertyId}/ownership`} className="btn btn-ghost" style={{ fontSize: 11.5 }}>
            Edit ownership & documents →
          </Link>
        </div>
        <div style={{ display: 'flex', marginTop: 10, width: 'max-content', border: '1px solid var(--color-divider)' }}>
          <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', padding: '0 15px', fontSize: 12, background: !notOwned ? 'var(--color-text)' : 'transparent', color: !notOwned ? 'var(--color-bg)' : 'var(--color-text)' }}>
            Owned by the customer
          </div>
          <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', padding: '0 15px', fontSize: 12, background: notOwned ? 'var(--color-text)' : 'transparent', color: notOwned ? 'var(--color-bg)' : 'var(--color-text)', borderLeft: '1px solid var(--color-divider)' }}>
            Not the owner
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div style={{ border: '1px solid var(--color-divider)', padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>Sale deed</div>
            <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 7 }}>{saleDeed ? `Uploaded ${saleDeed.uploaded_at?.slice(0, 10)}` : 'Not received yet.'}</div>
            {saleDeedUrl && (
              <a href={saleDeedUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11, padding: '0 10px', marginTop: 9, display: 'inline-flex', textDecoration: 'none' }}>
                View
              </a>
            )}
          </div>
          <div style={{ border: '2px solid var(--color-accent)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>Owner ID proof</div>
              {ownership?.owner_id_proof_url && <span className="tag tag-accent" style={{ fontSize: 9.5 }}>Reused</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 7 }}>{idProofDoc || ownership?.owner_id_proof_url ? 'On file.' : 'Not received yet.'}</div>
            {idProofUrl && (
              <a href={idProofUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11, padding: '0 10px', marginTop: 9, display: 'inline-flex', textDecoration: 'none' }}>
                View
              </a>
            )}
          </div>
        </div>

        {notOwned && (
          <div style={{ border: '1px solid var(--color-divider)', padding: 12, marginTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600 }}>Letter of approval from the original owner</div>
            <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 5 }}>Required when the customer is not the owner.</div>
            <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 7 }}>{approvalDoc || ownership?.approval_letter_url ? 'On file.' : 'Not received yet.'}</div>
            {approvalUrl && (
              <a href={approvalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ minHeight: 30, fontSize: 11, padding: '0 10px', marginTop: 9, display: 'inline-flex', textDecoration: 'none' }}>
                View
              </a>
            )}
          </div>
        )}

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 14 }}>
          <div style={{ fontSize: 12.5 }}>
            Customer asked for an EC copy: <strong>{ownership?.ec_digital_copy_requested ? 'Yes' : 'No'}</strong>
          </div>
        </div>

        <PropertyVerificationActions
          propertyId={propertyId}
          propertyName={property.property_name}
          hasIdProof={!!(idProofDoc || ownership?.owner_id_proof_url)}
        />

        <div style={{ marginTop: 18 }}>
          <DeletePropertyButton propertyId={propertyId} />
        </div>
      </div>

      <TimelineOutboxPanel
        entityType="property"
        entityId={propertyId}
        whatsappEntityType="property"
        extra={
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 24 }}>Visit credits</div>
            <VisitCreditsPanel propertyId={propertyId} creditBatch={creditBatch} />
          </div>
        }
      />
    </div>
  );
}

function VisitCreditsPanel({ propertyId, creditBatch }: { propertyId: string; creditBatch: any }) {
  if (!creditBatch) {
    return <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', borderTop: '1px solid var(--color-divider)', marginTop: 9, paddingTop: 10 }}>No visit credits issued yet.</p>;
  }
  const remaining = (creditBatch.quantity_purchased ?? 0) - (creditBatch.quantity_used ?? 0);
  return (
    <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 9, paddingTop: 10 }}>
      <div style={{ fontSize: 12.5 }}>
        {remaining} of {creditBatch.quantity_purchased} unused · expire {creditBatch.expires_at}
      </div>
      <ExtendCreditsForm propertyId={propertyId} disabled={!!creditBatch.extension_granted} />
      {creditBatch.extension_granted && (
        <div style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 7 }}>
          Already extended by {creditBatch.extension_days} days — {creditBatch.extension_reason}
        </div>
      )}
    </div>
  );
}
