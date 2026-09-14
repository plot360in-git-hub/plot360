import { getDashboardTiles } from './dashboard.actions';
import { getFailedWhatsAppMessages } from './whatsapp-log.actions';
import { ResendOutboxButton } from './ResendOutboxButton';

// Redesign 2026-09 — admin console Dashboard ("Waiting on you" — design_
// handoff_plot360_redesign, "Plot360 Admin.dc.html"). Replaces
// AdminQueue.tsx (a flat pending-properties list, kept intact but no
// longer wired — see ARCHITECTURE.md) as the /admin index.
export async function AdminDashboard() {
  const [tiles, failed] = await Promise.all([getDashboardTiles(), getFailedWhatsAppMessages()]);
  const now = new Date();
  const pastDayCount = tiles.reduce((sum, t) => sum + t.late, 0);

  return (
    <div>
      <div style={{ padding: '24px 26px 0' }}>
        <h2 style={{ fontSize: 25, letterSpacing: '-0.02em' }}>Waiting on you</h2>
        <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 5 }}>
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · {pastDayCount} item
          {pastDayCount === 1 ? '' : 's'} past 24 hours
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 20, borderTop: '2px solid var(--color-divider)', borderLeft: '1px solid var(--color-divider)' }}>
          {tiles.map((t) => (
            <a
              key={t.id}
              href={t.href}
              style={{
                textAlign: 'left',
                borderRight: '1px solid var(--color-divider)',
                borderBottom: '1px solid var(--color-divider)',
                padding: '16px 16px 18px',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', lineHeight: 1.3, minHeight: 24 }}>{t.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, color: t.late > 0 ? 'var(--p-alert)' : 'var(--color-text)' }}>{t.count}</div>
                {t.late > 0 && <div style={{ fontSize: 10.5, color: 'var(--color-accent-700)' }}>{t.late} past 24h</div>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 6, lineHeight: 1.4 }}>{t.note}</div>
            </a>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 26px 30px' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Failed WhatsApp messages</div>
        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 9 }}>
          {failed.map((m: any) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <div style={{ width: 8, height: 8, background: 'var(--color-accent)', flex: 'none' }} />
              <div style={{ flex: 1, fontSize: 12.5 }}>{m.body}</div>
              <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>{m.failure_reason || 'failed'}</div>
              <ResendOutboxButton messageId={m.id} />
            </div>
          ))}
          {failed.length === 0 && <p style={{ padding: '14px 0', fontSize: 12.5, color: 'var(--p-ink-soft)' }}>No failed messages right now.</p>}
        </div>
      </div>
    </div>
  );
}
