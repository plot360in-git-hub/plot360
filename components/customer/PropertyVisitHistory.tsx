import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getVisitCreditsForProperty, getOpenVisitRequestCounts } from '@/components/payments/visitCredits.actions';
import { totalRemainingCredits, nearestExpiry, canScheduleVisit } from '@/lib/visitCredits';

const VISIT_STATUS_LABEL: Record<string, string> = {
  assigned: 'Agent assigned',
  accepted: 'Agent on the way',
  submitted: 'Under review',
  approved: 'Report ready',
  ec_pending: 'Report ready — EC pending',
  rejected: 'Sent back for changes',
};

// Redesign 2026-09 — "Property visit history" screen (design_handoff_
// plot360_redesign, "Plot360 Customer.dc.html"), replacing the old
// PropertyView as the main /properties/[id] page. Deliberately does NOT
// re-render the old PropertyView/MonitoringStatus components — this is a
// new, self-contained read of the same data with the new visual design;
// PropertyView.tsx is kept (unused-but-intact) rather than deleted, per
// the redesign's "don't remove existing code" instruction. TaskList still
// renders below this on the page (app/properties/[id]/page.tsx) since
// it's an unrelated feature this redesign doesn't touch.
export async function PropertyVisitHistory({ propertyId }: { propertyId: string }) {
  const supabase = await createClient();
  const [{ data: property }, credits, { data: jobs }, reservedCounts] = await Promise.all([
    supabase.from('properties').select('*').eq('id', propertyId).single(),
    getVisitCreditsForProperty(propertyId),
    supabase
      .from('monitoring_jobs')
      .select('id, status, visit_number, assigned_at, decided_at')
      .eq('property_id', propertyId)
      .order('assigned_at', { ascending: false }),
    getOpenVisitRequestCounts([propertyId]),
  ]);

  if (!property) return <p className="p360" style={{ padding: 24 }}>Property not found.</p>;

  const reserved = reservedCounts[propertyId] ?? 0;
  const remaining = Math.max(totalRemainingCredits(credits) - reserved, 0);
  const expiry = nearestExpiry(credits);
  const gate = canScheduleVisit(property.status, credits);

  return (
    <div className="p360" style={{ minHeight: '60vh', padding: '28px 20px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <p style={{ fontSize: 12, color: 'var(--p-ink-muted)', marginBottom: 4 }}>
          <Link href="/dashboard" className="nav-link">← Home</Link>
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h1 style={{ fontSize: 24 }}>{property.property_name}</h1>
          <span className={`tag ${property.status === 'verified' ? 'tag-accent' : ''}`} style={{ border: '1px solid var(--color-divider)' }}>
            {property.status === 'verified' ? 'Verified' : property.status === 'rejected' ? 'Rejected' : 'Not verified yet'}
          </span>
        </div>
        {property.street_address && <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)', marginBottom: 24 }}>{property.street_address}</p>}

        {property.status === 'rejected' && property.rejection_reason && (
          <div className="card" style={{ borderColor: 'var(--color-accent)', marginBottom: 20 }}>
            <p style={{ fontSize: 13.5 }}>{property.rejection_reason}</p>
          </div>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: 'var(--p-ink-soft)', marginBottom: 6 }}>Visit credits</p>
          <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            {remaining} of {credits.reduce((s, c) => s + c.quantity_purchased, 0)} left
          </p>
          {expiry && (
            <p style={{ fontSize: 12.5, color: 'var(--p-ink-muted)', marginBottom: 16 }}>
              Usable until {expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {gate.eligible && gate.hasCredits && remaining > 0 ? (
              <Link href={`/properties/${propertyId}/schedule`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Schedule the next visit
              </Link>
            ) : (
              <Link href={`/properties/${propertyId}/plan`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Buy visit credits
              </Link>
            )}
            <Link href="/service-requests/new" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Raise a service request
            </Link>
          </div>
          {!gate.eligible && gate.reason && (
            <p style={{ fontSize: 12.5, color: 'var(--p-ink-muted)', marginTop: 10 }}>{gate.reason}</p>
          )}
        </div>

        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Visit history</h3>
        {(jobs ?? []).length === 0 && <p style={{ fontSize: 13.5, color: 'var(--p-ink-soft)' }}>No visits yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(jobs ?? []).map((j) => (
            <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <div>
                <p style={{ fontSize: 14 }}>Visit {j.visit_number ?? '—'}</p>
                <p style={{ fontSize: 12, color: 'var(--p-ink-muted)' }}>
                  {(j.decided_at ?? j.assigned_at)?.slice(0, 10)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="tag" style={{ border: '1px solid var(--color-divider)' }}>{VISIT_STATUS_LABEL[j.status] ?? j.status}</span>
                {['approved', 'ec_pending'].includes(j.status) && (
                  <Link href={`/properties/${propertyId}/visit-report/${j.id}`} className="nav-link" style={{ fontSize: 12.5 }}>
                    View report
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
