// Redesign 2026-09 (follow-up, round 22) — small display-only helpers
// shared by the new agent "Account under review" and "Profile & SRO"
// screens (design_handoff_plot360_redesign, "Plot360 Field Agent" mocks).

// agentDisplayId is a shorthand, not a real sequential agent ID — the
// schema has none. Same honest-substitution pattern already used for
// properties' P-<id> code (PropertyVisitHistory.tsx) and the UPI-<timestamp>
// payment reference (visitCredits.actions.ts).
export function agentDisplayId(agentId: string) {
  return `FA-${agentId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

// Same masking shape as components/customer/home.data.ts's maskPhone,
// duplicated (not imported) so the agent area doesn't reach into the
// customer area for a four-line pure function.
export function maskAgentPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return `${digits.slice(0, 4)} ••• ${digits.slice(-2)}`;
}

export function buildAgentWelcomeMessage(firstName: string, missingDocs: string[]) {
  const base = `Plot360: Welcome, ${firstName}. Your field agent account is created and under review. We will message you once verified.`;
  if (missingDocs.length === 0) return base;
  return `${base} Missing: ${missingDocs.join(', ')}. Reply here with a photo and we will add it.`;
}
