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
