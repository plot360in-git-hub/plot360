import Link from 'next/link';
import { getAssignmentTarget, getSuggestedAgents, getAllAgentsForOverride } from './assignment.actions';
import { profileDisplayName } from './displayName';
import { AssignAgentButtons } from './AssignAgentButtons';

// Redesign 2026-09 — admin console, Assign screen (design_handoff_
// plot360_redesign, "Plot360 Admin.dc.html"). Reachable from the Job
// assignment queue for both assignment origins — see assignment.
// actions.ts for why there are two ("legacy" subscription/due-date
// model vs "visit_request" customer self-service scheduling).
export async function AssignmentScreen({ kind, id }: { kind: 'legacy' | 'visit_request' | 'stuck'; id: string }) {
  const target = await getAssignmentTarget(kind, id);
  if (!target) return <p style={{ padding: 24 }}>This visit is no longer waiting for assignment.</p>;

  const [suggested, allAgents] = await Promise.all([getSuggestedAgents(target.sroCode), getAllAgentsForOverride(target.sroCode)]);
  const suggestedIds = new Set(suggested.map((a: any) => a.id));
  const overrideAgents = allAgents.filter((a: any) => !suggestedIds.has(a.id));

  return (
    <div style={{ padding: '22px 26px 30px' }}>
      <Link href="/admin/queue/job-assignment" className="btn btn-ghost" style={{ fontSize: 12, paddingLeft: 0 }}>
        ← Back to queue
      </Link>
      <h2 style={{ fontSize: 24, letterSpacing: '-0.02em', margin: '12px 0 0' }}>Assign a visit · {target.propertyName}</h2>
      <div style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', marginTop: 4 }}>
        {target.address}
        {target.window ? ` · window ${target.window}` : ''}
        {target.sroCode ? ` · SRO ${target.sroCode}` : ''}
      </div>

      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 22 }}>
        {target.sroCode ? `Suggested — SRO matches ${target.sroCode}` : 'Suggested'}
      </div>
      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 9 }}>
        {suggested.map((a: any, i: number) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ width: 26, flex: 'none', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, color: 'var(--color-accent-700)' }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{profileDisplayName(a.profiles)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 2 }}>
                SRO {a.sro_name} {a.sro_code} · {a.completedVisits} visits completed
              </div>
            </div>
            <div style={{ width: 120, flex: 'none', fontSize: 11.5, color: 'var(--p-ink-soft)' }}>{a.openJobs} open job{a.openJobs === 1 ? '' : 's'}</div>
            <AssignAgentButtons kind={kind} targetId={id} agentId={a.id} label="Assign" primary />
          </div>
        ))}
        {suggested.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', padding: '10px 0' }}>No verified agent matches this SRO yet — use the manual override below.</p>}
      </div>

      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)', marginTop: 24 }}>All agents — manual override</div>
      <div style={{ fontSize: 11.5, color: 'var(--p-ink-soft)', marginTop: 9 }}>Assigning outside the SRO is allowed and recorded.</div>
      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 11 }}>
        {overrideAgents.map((a: any) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{profileDisplayName(a.profiles)}</div>
              <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 2 }}>SRO {a.sro_name} {a.sro_code}</div>
            </div>
            <div style={{ width: 130, flex: 'none', fontSize: 11, color: a.sroMatches ? 'var(--p-ink-soft)' : 'var(--p-alert)' }}>{a.sroMatches ? 'SRO match' : 'SRO — no match'}</div>
            <AssignAgentButtons kind={kind} targetId={id} agentId={a.id} label="Assign anyway" />
          </div>
        ))}
        {overrideAgents.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--p-ink-soft)', padding: '10px 0' }}>No other verified agents available.</p>}
      </div>

      <div style={{ background: 'var(--color-surface)', padding: '15px 16px', borderLeft: '3px solid var(--color-accent)', marginTop: 22 }}>
        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--p-ink-soft)' }}>WhatsApp the agent will get</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 7 }}>
          Plot360: New visit job. Property: {target.propertyName}. Location: {target.address}. {target.window ? `Window: ${target.window}. ` : ''}Upload link: (sent on assignment, closes on submit or in 7 days).
        </div>
        <div style={{ fontSize: 11, color: 'var(--p-ink-soft)', marginTop: 8 }}>No owner name, phone or document is included.</div>
      </div>
    </div>
  );
}
