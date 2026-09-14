import { QueueControls, QueuePager } from './QueueControls';
import type { QueueRow } from './queues.actions';

// Redesign 2026-09 — admin console. Generic queue table shared by all
// six queues (design_handoff_plot360_redesign, "Plot360 Admin.dc.html"
// — one shared table layout: name/place/state/colD/waiting, 20 rows a
// page, no bulk actions). Used by app/admin/queue/*/page.tsx.
export function QueueScreen({
  title,
  note,
  colA,
  colB,
  colD,
  searchPlaceholder,
  sorts,
  result,
  query,
}: {
  title: string;
  note: string;
  colA: string;
  colB: string;
  colD: string;
  searchPlaceholder: string;
  sorts: { key: string; label: string }[];
  result: { rows: QueueRow[]; total: number; page: number; pageCount: number };
  query: string;
}) {
  const { rows, total, page, pageCount } = result;
  const start = total === 0 ? 0 : (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);

  return (
    <div>
      <div style={{ padding: '22px 26px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 23, letterSpacing: '-0.02em' }}>{title}</h2>
            <div style={{ fontSize: 12, color: 'var(--p-ink-soft)', marginTop: 4 }}>{note}</div>
          </div>
          <QueueControls searchPlaceholder={searchPlaceholder} sorts={sorts} />
        </div>
      </div>
      <div style={{ padding: '14px 26px 0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {[colA, colB, 'State', colD, 'Waiting', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: 'left',
                      padding: i === 0 ? '8px 10px 8px 0' : '8px 10px',
                      borderBottom: '2px solid var(--color-divider)',
                      fontSize: 9.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ background: r.late ? 'var(--p-tint)' : 'transparent' }}>
                  <td style={{ padding: '7px 10px 7px 0', borderBottom: '1px solid var(--color-divider)', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{r.place}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ color: r.urgent ? 'var(--p-alert)' : 'var(--color-text)' }}>{r.state}</span>
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', color: 'var(--p-ink-soft)' }}>{r.window}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--color-divider)', color: r.late ? 'var(--p-alert)' : 'var(--p-ink-soft)', fontWeight: r.late ? 600 : 400 }}>
                    {r.wait}
                  </td>
                  <td style={{ padding: '5px 0', borderBottom: '1px solid var(--color-divider)', textAlign: 'right' }}>
                    <a href={r.href} className="btn btn-secondary" style={{ minHeight: 28, fontSize: 11, padding: '0 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '20px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)' }}>
                      {query ? `No rows match “${query}” in this queue.` : 'Nothing waiting in this queue right now.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 30px', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>
            {total === 0 ? 'No rows' : `Showing ${start}–${end} of ${total}`} · no bulk actions, every item is opened and reviewed
          </div>
          <QueuePager page={page} pageCount={pageCount} />
        </div>
      </div>
    </div>
  );
}
