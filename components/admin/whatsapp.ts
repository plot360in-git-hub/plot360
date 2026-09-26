// Builds a https://wa.me/... deep link that opens WhatsApp (Web, Desktop,
// or the mobile app) with a message pre-filled. Nothing sends automatically —
// the admin still taps Send inside WhatsApp. No API keys, no cost, no
// business account setup required.
export function buildWhatsAppLink(phoneCountryCode: string | null | undefined, phoneNumber: string | null | undefined, message: string) {
  const digitsOnly = `${phoneCountryCode ?? ''}${phoneNumber ?? ''}`.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot's replacement for the old
// "Plot360 — New property monitoring job assigned / Property Name: .../
// Plot Size: .../ Address: ..." label-value dump, in the same Dear-<name>/
// Thanks-Plot360-Team letter format as the customer-facing messages above.
// `agentName` is new — every call site now fetches it via
// getAssignmentWhatsAppDetails (monitoring.actions.ts), same shape as
// customerDisplayName below. `googlePin` collapses the old three separate
// optional lines (Location Map / GPS Coordinates / Nearby Landmark) into
// the one "Google pin" line Plot's template asks for — buildGooglePinText
// below picks the best single value to show, in the same preference order
// those three lines used to be checked in.
export function buildAssignmentMessage(params: {
  agentName: string;
  propertyName: string;
  plotSize: string;
  address: string;
  mapUrl: string | null;
  gpsCoordinate: string | null;
  nearbyLandmark: string | null;
  uploadLink: string;
}) {
  return [
    `Dear ${params.agentName},`,
    ``,
    `A new visit job for ${params.propertyName} has been created and assigned to you.`,
    ``,
    `Location: ${params.address || 'Not recorded'}`,
    ...(params.plotSize.trim() ? [`Plot size: ${params.plotSize}`] : []),
    `Google pin: ${buildGooglePinText(params)}`,
    ``,
    `Once your job is complete, please use the link below to upload your work:`,
    params.uploadLink,
    ``,
    `This link will close once your job is submitted, or in 7 days.`,
    ``,
    `Thanks,`,
    `Plot360 Team`,
  ].join('\n');
}

function buildGooglePinText(params: { mapUrl: string | null; gpsCoordinate: string | null; nearbyLandmark: string | null }): string {
  return params.mapUrl || params.gpsCoordinate || params.nearbyLandmark || 'Not recorded';
}

// Redesign 2026-09 (follow-up) — Plot's fixed wording for the "need more
// info from the owner" message sent from the Property verification detail
// screen, before the property has been approved or rejected. "with you
// collect" corrected to "with you to collect" per Plot's follow-up.
//
// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: this "welcome" message
// (the first thing a customer hears back at property-verification stage)
// should tell them up front what to have ready for our member, instead of
// leaving "remaining information" vague until someone actually calls them.
// Added the fixed checklist Plot gave verbatim (site address, map pin, ID
// proof, last page of the sale deed) as a bulleted follow-on to the same
// opening paragraph — wording tightened for a professional business
// message (e.g. "any Govt issued Phot ID proof" → "any government-issued
// photo ID proof (Driving Licence, Voter ID, Aadhaar, etc.)") without
// changing what's being asked for.
export function buildAdditionalInfoMessage(customerName: string) {
  return [
    `Dear ${customerName},`,
    ``,
    `Thank you for choosing, trusting and providing us an opportunity to serve you. Before we move to the next steps, we need additional information and our member will be in touch with you to collect the remaining information. Could you please be ready with the following:`,
    ``,
    `- Site address: city/village, mandal, district`,
    `- Google Map pin or location link`,
    `- ID proof: any government-issued photo ID (Driving Licence, Voter ID, Aadhaar, etc.)`,
    `- Last page of the sale deed: showing plot no., survey no., village, mandal, plot size, owner name, and the diagram (if present)`,
    ``,
    `Thank you,`,
    `Plot360 Team`,
  ].join('\n');
}

// Redesign 2026-09 (follow-up, 2026-09-26) — shared "who am I writing to"
// helper. Every WhatsApp message built here opens with "Dear <name>," and
// each caller was independently repeating the same
// "[first, last].filter(Boolean).join(' ') || username || 'Customer'"
// fallback chain (see sendAdditionalInfoRequest above, the original of
// this pattern) — pulled out once so the four professional message
// builders below (and any future one) can't drift from it.
export function customerDisplayName(profile: { first_name?: string | null; last_name?: string | null; username?: string | null } | null | undefined): string {
  if (!profile) return 'Customer';
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username || 'Customer';
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot: "After verification of
// property message is also need a professional thanks message", replacing
// the old one-line "Plot360: <name> is verified. We will be in touch..."
// with Plot's own Dear-<name>/Thanks-Plot360-Team letter format, matching
// the other three messages below.
export function buildPropertyVerifiedMessage(customerName: string, propertyName: string) {
  return [
    `Dear ${customerName},`,
    ``,
    `Thank you for sharing and providing the required information for completing ${propertyName} verification. We will be in touch to schedule your first visit. Please sit back and relax while we get your visit report ready.`,
    ``,
    `Thanks,`,
    `Plot360 Team`,
  ].join('\n');
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot's replacement for the old
// one-line "Plot360: Payment received for <name>, valid until <date>..."
// message. amount/visitQuantity/validUntil all come from recordPayment's
// return value (payments.actions.ts) — visitQuantity is null only for a
// legacy payment with no plan attached, in which case the visit count is
// simply left out of the sentence rather than showing a wrong "0 visits".
export function buildPaymentConfirmedMessage(params: {
  customerName: string;
  propertyName: string;
  amount: number;
  visitQuantity: number | null;
  validUntil: string;
}) {
  const amountText = `₹${params.amount.toLocaleString('en-IN')}`;
  const visitText = params.visitQuantity ? ` for ${params.visitQuantity} visit${params.visitQuantity === 1 ? '' : 's'}` : '';
  const expiryText = formatDateForMessage(params.validUntil);
  return [
    `Dear ${params.customerName},`,
    ``,
    `Thank you for the payment of ${amountText} for the ${params.propertyName} plot. This is valid${visitText} and will expire by ${expiryText}. Your visit will now be scheduled.`,
    ``,
    `Thanks,`,
    `Plot360 Team`,
  ].join('\n');
}

// Redesign 2026-09 (follow-up, 2026-09-26) — Plot's replacement for the old
// one-line "Plot360: Your visit report for <name> is ready, with
// photographs and your EC copy." message, now also carrying a direct link
// to the visit report PDF. reportUrl is a no-login token link
// (app/r/[token], see components/customer/report-link.actions.ts) so it
// opens directly in WhatsApp's cookie-less in-app browser — an earlier
// version pointed at the cookie-authenticated
// app/properties/[id]/visit-report/[jobId]/pdf route, which WhatsApp's
// browser could never satisfy even for a customer logged in elsewhere.
// includesEcCopy is computed by the caller (approveSubmission) as
// `ecRequested && !ecPending` — true only once an EC was both asked for
// AND is actually in the report; `false` covers both "never asked for one"
// and "asked for one, still pending" so the message never claims a copy
// that isn't there yet.
export function buildVisitReportReadyMessage(params: {
  customerName: string;
  propertyName: string;
  reportUrl: string;
  includesEcCopy: boolean;
}) {
  const docsText = params.includesEcCopy ? 'with photographs and your EC copy' : 'with photographs and other documents';
  return [
    `Dear ${params.customerName},`,
    ``,
    `Thank you for giving us the opportunity and for trusting Plot360. We have completed the visit, and your visit report for ${params.propertyName} is ready, ${docsText}. You can also access your report using this link:`,
    params.reportUrl,
    ``,
    `Thanks,`,
    `Plot360 Team`,
  ].join('\n');
}

function formatDateForMessage(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildCompletionMessage(propertyName: string) {
  return `Plot360 — Your monitoring visit for "${propertyName}" has been reviewed and approved by the admin. Thank you for completing this job — it's now closed.`;
}

export function buildRejectionMessage(params: { propertyName: string; feedback: string; uploadLink: string }) {
  return [
    `Plot360 — Your submission for "${params.propertyName}" needs some changes before it can be approved.`,
    ``,
    `Admin feedback: ${params.feedback}`,
    ``,
    `Please review the feedback, revisit if needed, and re-upload here (link valid 7 days):`,
    params.uploadLink,
  ].join('\n');
}

// Sent when a job is handed to a different agent (previous one dropped
// it, ran out of time, or work didn't work out) — deliberately distinct
// from buildAssignmentMessage so the new agent understands the context
// instead of reading it as a totally fresh, unexplained assignment.
//
// Redesign 2026-09 (follow-up, 2026-09-26) — same letter-format rework as
// buildAssignmentMessage above, for consistency (Plot's example only
// covered the fresh-assignment message, but this one shares its exact
// structure and is read by the same audience, so leaving it in the old
// label-value format would have been an inconsistency, not a deliberate
// choice).
export function buildReassignmentMessage(params: {
  agentName: string;
  propertyName: string;
  plotSize: string;
  address: string;
  mapUrl: string | null;
  gpsCoordinate: string | null;
  nearbyLandmark: string | null;
  uploadLink: string;
}) {
  return [
    `Dear ${params.agentName},`,
    ``,
    `A visit job for ${params.propertyName} was previously assigned to another agent but wasn't completed, so it has now been reassigned to you.`,
    ``,
    `Location: ${params.address || 'Not recorded'}`,
    ...(params.plotSize.trim() ? [`Plot size: ${params.plotSize}`] : []),
    `Google pin: ${buildGooglePinText(params)}`,
    ``,
    `Once your job is complete, please use the link below to upload your work:`,
    params.uploadLink,
    ``,
    `This link will close once your job is submitted, or in 7 days.`,
    ``,
    `Thanks,`,
    `Plot360 Team`,
  ].join('\n');
}
