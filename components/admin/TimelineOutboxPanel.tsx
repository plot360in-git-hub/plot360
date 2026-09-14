import { getTimeline, type TimelineEntityType } from './timeline.actions';
import { getOutboxForEntity, type WhatsAppEntityType } from './whatsapp-log.actions';
import { profileDisplayName } from './displayName';
import { ResendOutboxButton } from './ResendOutboxButton';

// Redesign 2026-09 — admin console. The right-hand "Internal timeline" +
// "WhatsApp outbox" pane shared by the Property verification and
// Submission review detail screens.
export async function TimelineOutboxPanel({
  entityType,
  entityId,
  whatsappEntityType,
  extra,
}: {
  entityType: TimelineEntityType;
  entityId: string;
  whatsappEntityType: WhatsAppEntityType;
  extra?: React.ReactNode;
}) {
  const [timeline, outbox] = await Promise.all([getTimeline(entityType, entityId), getOutboxForEntity(whatsappEntityType, entityId)]);

  return (
    <div style={{ width: 320, flex: 'none', borderLeft: '2px solid var(--color-divider)', padding: '22px 20px 30px', overflowY: 'auto' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>Internal timeline</div>
      <div style={{ marginTop: 10 }}>
        {timeline.map((t: any) => (
          <div key={t.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: '1px solid var(--color-divider)' }}>
            <div style={{ width: 52, flex: 'none', fontSize: 10.5, fontFamily: 'ui-monospace, Menlo, monospace', color: 'var(--p-ink-soft)', paddingTop: 2 }}>
              {t.created_at?.slice(5, 10)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                {t.action}
                {t.note ? ` — ${t.note}` : ''}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', marginTop: 2 }}>{profileDisplayName(t.profiles) || 'System'}</div>
            </div>
          </div>
        ))}
        {timeline.length === 0 && <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', padding: '9px 0' }}>No internal activity logged yet.</p>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--p-ink-soft)', lineHeight: 1.5, marginTop: 10 }}>Internal only. The customer sees milestone updates only.</div>

      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 24 }}>WhatsApp outbox</div>
      <div style={{ marginTop: 10 }}>
        {outbox.map((o: any) => (
          <div key={o.id} style={{ borderTop: '1px solid var(--color-divider)', padding: '10px 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 11, color: o.state === 'failed' ? 'var(--p-alert)' : 'var(--p-ink-soft)' }}>
                {o.state === 'failed' ? `Failed — ${o.failure_reason || 'not delivered'}` : 'Delivered'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--p-ink-soft)' }}>{o.created_at?.slice(0, 10)}</div>
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 5 }}>{o.body}</div>
            {o.state === 'failed' && (
              <div style={{ marginTop: 7 }}>
                <ResendOutboxButton messageId={o.id} />
              </div>
            )}
          </div>
        ))}
        {outbox.length === 0 && <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', padding: '9px 0' }}>No messages sent yet.</p>}
      </div>

      {extra}
    </div>
  );
}
