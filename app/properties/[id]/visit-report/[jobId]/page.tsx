import { getVisitReportData } from '@/components/properties/monitoring/monitoring.actions';
import { PrintReportButton } from '@/components/properties/monitoring/PrintReportButton';
import { VISIT_QUESTIONS } from '@/lib/visitReportQuestions';

const MEDIA_VISIBLE_STATUSES = ['approved', 'ec_pending'];

export default async function VisitReportPage({ params }: { params: Promise<{ id: string; jobId: string }> }) {
  const { jobId } = await params;
  const data = await getVisitReportData(jobId);

  if (!data || !MEDIA_VISIBLE_STATUSES.includes(data.job.status)) {
    return (
      <main className="container-narrow" style={{ paddingTop: 60 }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
          <p>This visit report isn't available yet.</p>
        </div>
      </main>
    );
  }

  const { job, media } = data;
  const property = job.properties;
  const address = [property?.street_address, property?.village_town, property?.district, property?.state]
    .filter(Boolean)
    .join(', ');
  const photos = media.filter((m) => m.media_type === 'photo');
  const visitDate = job.decided_at?.slice(0, 10) ?? job.submitted_at?.slice(0, 10) ?? '—';
  const generatedDate = new Date().toISOString().slice(0, 10);

  return (
    <main style={{ background: 'var(--color-bg-alt)', paddingTop: 40, paddingBottom: 60 }}>
      <style>{`
        @media print {
          nav, header, .no-print { display: none !important; }
          body { background: #fff !important; }
          .visit-report-card { border: 1px solid #ddd !important; break-inside: avoid; }
        }
      `}</style>

      <div className="container-narrow" style={{ maxWidth: 720 }}>
        <div className="no-print" style={{ textAlign: 'center', marginBottom: 20 }}>
          <PrintReportButton />
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: '32px 40px 40px', border: '1px solid var(--color-border)' }}>
          {/* Masthead */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid var(--color-text)', paddingBottom: 16, marginBottom: 24 }}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>PLOT360</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <a href="https://www.plot360.in" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>www.plot360.in</a>
              <br />
              Contact: <a href="mailto:support@plot360.in" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>support@plot360.in</a>
            </div>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 4px' }}>Property Visit Report</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 28 }}>
            Visit date: {visitDate} · Report generated: {generatedDate}
          </p>

          <div className="visit-report-card" style={{ border: '1px solid var(--color-border)', borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Property</h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 24, margin: 0 }}>
              <div><p className="field-label" style={{ marginBottom: 2 }}>Property Name</p><dd style={{ margin: 0, fontSize: 15 }}>{property?.property_name}</dd></div>
              <div><p className="field-label" style={{ marginBottom: 2 }}>Plot Size</p><dd style={{ margin: 0, fontSize: 15 }}>{property?.plot_size} {property?.plot_size_unit}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><p className="field-label" style={{ marginBottom: 2 }}>Address</p><dd style={{ margin: 0, fontSize: 15 }}>{address}</dd></div>
            </dl>
          </div>

          <div className="visit-report-card" style={{ border: '1px solid var(--color-border)', borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Verification Checklist</h3>
            <dl style={{ display: 'grid', rowGap: 0, margin: 0 }}>
              {VISIT_QUESTIONS.map((q, i) => (
                <div
                  key={q.key}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    padding: i === 0 ? '0 0 10px' : '10px 0', fontSize: 14,
                  }}
                >
                  <dt>{q.label}</dt>
                  <dd style={{ margin: 0, marginLeft: 16, textAlign: 'right' }}>
                    {q.type === 'boolean' ? (
                      job[q.key] === null || job[q.key] === undefined ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      ) : (
                        <span className={`status-pill ${job[q.key] ? 'pending' : 'verified'}`}>{job[q.key] ? 'Yes' : 'No'}</span>
                      )
                    ) : (
                      job[q.key] || <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {job.observations && (
            <div className="visit-report-card" style={{ border: '1px solid var(--color-border)', borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Agent's Additional Observations</h3>
              <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: 0 }}>{job.observations}</p>
            </div>
          )}

          {job.admin_remarks && (
            <div className="visit-report-card" style={{ border: '1px solid var(--color-border)', borderRadius: 20, padding: '20px 24px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Admin Remarks</h3>
              <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: 0 }}>{job.admin_remarks}</p>
            </div>
          )}

          <div className="visit-report-card" style={{ border: '1px solid var(--color-border)', borderRadius: 20, padding: '20px 24px' }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Photos</h3>
            {photos.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {photos.map((m) =>
                  m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={m.id} href={m.url}>
                      <img src={m.url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} />
                    </a>
                  ) : null
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>No photos on this visit.</p>
            )}
            <p className="no-print" style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 12, marginBottom: 0 }}>
              Videos aren't included in this printed report — view them from the property page.
            </p>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            This report was generated by Plot360 based on a physical site visit by a verified field agent.
            <br />
            © {new Date().getFullYear()} Plot360. All rights reserved.
          </div>
        </div>
      </div>
    </main>
  );
}
