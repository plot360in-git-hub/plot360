// Builds a https://wa.me/... deep link that opens WhatsApp (Web, Desktop,
// or the mobile app) with a message pre-filled. Nothing sends automatically —
// the admin still taps Send inside WhatsApp. No API keys, no cost, no
// business account setup required.
export function buildWhatsAppLink(phoneCountryCode: string | null | undefined, phoneNumber: string | null | undefined, message: string) {
  const digitsOnly = `${phoneCountryCode ?? ''}${phoneNumber ?? ''}`.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export function buildAssignmentMessage(params: {
  propertyName: string;
  plotSize: string;
  address: string;
  mapUrl: string | null;
  gpsCoordinate: string | null;
  nearbyLandmark: string | null;
  uploadLink: string;
}) {
  const lines = [
    `Plot360 — New property monitoring job assigned`,
    ``,
    `Property Name: ${params.propertyName}`,
    `Plot Size: ${params.plotSize}`,
    `Address: ${params.address}`,
  ];
  if (params.mapUrl) lines.push(`Location Map: ${params.mapUrl}`);
  if (params.gpsCoordinate) lines.push(`GPS Coordinates: ${params.gpsCoordinate}`);
  if (params.nearbyLandmark) lines.push(`Nearby Landmark / Map Pin: ${params.nearbyLandmark}`);
  lines.push(``, `Upload your photos, videos, and notes here (valid 7 days):`, params.uploadLink);
  return lines.join('\n');
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
export function buildReassignmentMessage(params: {
  propertyName: string;
  plotSize: string;
  address: string;
  mapUrl: string | null;
  gpsCoordinate: string | null;
  nearbyLandmark: string | null;
  uploadLink: string;
}) {
  const lines = [
    `Plot360 — Property monitoring job reassigned to you`,
    ``,
    `This job was previously assigned to another agent but wasn't completed, so it's now been`,
    `reassigned to you for a fresh visit.`,
    ``,
    `Property Name: ${params.propertyName}`,
    `Plot Size: ${params.plotSize}`,
    `Address: ${params.address}`,
  ];
  if (params.mapUrl) lines.push(`Location Map: ${params.mapUrl}`);
  if (params.gpsCoordinate) lines.push(`GPS Coordinates: ${params.gpsCoordinate}`);
  if (params.nearbyLandmark) lines.push(`Nearby Landmark / Map Pin: ${params.nearbyLandmark}`);
  lines.push(``, `Upload your photos, videos, and notes here (valid 7 days):`, params.uploadLink);
  return lines.join('\n');
}
