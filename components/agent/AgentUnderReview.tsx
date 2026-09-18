import Link from 'next/link';
import { agentDisplayId, maskAgentPhone } from './agentDisplay';
import { getOutboxForEntity } from '@/components/admin/whatsapp-log.actions';
import type { Profile, AgentProfile, AgentDocument } from '@/types/database.types';

// Redesign 2026-09 (follow-up, round 22) — "Account under review"
// (design_handoff_plot360_redesign, "Plot360 Field Agent" mocks): pulled
// out of app/agent/dashboard/page.tsx's inline pending-block (which only
// had the black header text before) into its own component, now also
// showing Agent ID, masked mobile, a document count, status, and the
// actual welcome WhatsApp logged at signup (agentSignUpAndRegister). Two
// honest simplifications: Agent ID is a display shorthand
// (agentDisplay.ts), not a real sequential ID; the document count is "of
// 2", not "of 4" — the schema
// only ever tracks two document types (driving_license, secondary_id),
// same honest simplification already used on the admin side
// (AgentVerificationDetail.tsx).
export async function AgentUnderReview({
  profile,
  agentProfile,
  documents,
}: {
  profile: Profile | null;
  agentProfile: AgentProfile;
  documents: Pick<AgentDocument, 'doc_type'>[];
}) {
  const outbox = await getOutboxForEntity('agent_profile', agentProfile.id);
  const latestMessage = outbox[0];
  const docsAttached = documents.length;

  return (
    <div className="p360" style={{ minHeight: '100vh' }}>
      {/* Redesign 2026-09 (follow-up) — Plot: "black color message style
          is old, update and match with new design." Swapped the flat
          var(--color-text) block for the app's actual "new design" hero
          card treatment (var(--gradient-hero) + var(--radius-lg)), the
          same one the customer home screen and the marketing hero use for
          a prominent welcome/status card — instead of the old plain black
          full-bleed banner. */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 20px 0' }}>
        <div
          style={{
            background: 'var(--gradient-hero)',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 22px 22px',
          }}
        >
          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent-800)', fontWeight: 700 }}>
            Under review
          </p>
          <h1 style={{ fontSize: 24, marginTop: 12 }}>Account created. Verification takes a day.</h1>
          <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 11 }}>
            A reviewer checks your mobile number and documents. If anything is missing we message you on WhatsApp and
            you can add it from your profile.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
        {[
          ['Agent ID', agentDisplayId(agentProfile.id)],
          ['Mobile', maskAgentPhone(profile?.phone_number) ?? 'Not set'],
          ['Documents', `${docsAttached} of 2 attached`],
          ['Status', 'Awaiting verification'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <span style={{ fontSize: 13, color: 'var(--p-ink-soft)' }}>{label}</span>
            <strong style={{ fontSize: 13 }}>{value}</strong>
          </div>
        ))}

        {latestMessage && (
          <div style={{ background: 'var(--color-surface)', padding: '12px 13px', borderLeft: '3px solid var(--color-accent)', marginTop: 18 }}>
            <p style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-ink-muted)' }}>
              WhatsApp sent to {maskAgentPhone(latestMessage.recipient_phone) ?? latestMessage.recipient_phone}
            </p>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>{latestMessage.body}</p>
          </div>
        )}

        <Link
          href="/agent/dashboard"
          className="btn btn-primary btn-block"
          style={{ marginTop: 20, marginBottom: 40, textDecoration: 'none' }}
        >
          Go to my jobs
        </Link>
      </div>
    </div>
  );
}
