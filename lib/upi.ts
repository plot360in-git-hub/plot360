// Redesign 2026-09 (follow-up, 2026-09-23) — Plot: the customer payment
// screen's "Opens your UPI app" was never actually a link at all — see
// ChoosePlanAndPay.tsx's old `pay()`, which just showed a full-screen
// "Opening your UPI app…" overlay for 1.4s (a setTimeout, nothing else)
// before marking the payment complete on its own. This builds the real
// deep link.
//
// upi://pay?... is the NPCI intent-flow spec every UPI-compliant app is
// required to register, on both Android and iOS — this is the one link
// to try first. Android additionally shows its own chooser when more
// than one UPI app is installed. The three app-specific schemes below
// are kept as an explicit fallback for the (mostly older iOS / edge-case
// Android) situation where the generic link doesn't trigger anything —
// same parameters, just each app's own documented custom scheme, so the
// customer can pick their app directly instead.
export type UpiLinkParams = {
  payeeVpa: string; // paymentSettings.upi_id — the merchant/admin's UPI ID
  payeeName: string; // shown inside the customer's UPI app as who they're paying
  amount: number; // rupees, e.g. 499
  note: string; // short transaction note, shown in the UPI app
  transactionRef: string; // our own payments.transaction_reference, passed through as tr=
};

function upiQueryString(p: UpiLinkParams): string {
  const params = new URLSearchParams({
    pa: p.payeeVpa,
    pn: p.payeeName,
    am: p.amount.toFixed(2),
    cu: 'INR',
    tn: p.note,
    tr: p.transactionRef,
  });
  return params.toString();
}

export function buildUpiLinks(p: UpiLinkParams) {
  const q = upiQueryString(p);
  return {
    generic: `upi://pay?${q}`,
    phonepe: `phonepe://pay?${q}`,
    googlePay: `tez://upi/pay?${q}`,
    paytm: `paytmmp://pay?${q}`,
  };
}
