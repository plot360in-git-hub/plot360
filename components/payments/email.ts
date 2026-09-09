// Sends app-triggered transactional emails (payment receipts, etc.) via
// Resend's HTTP API directly. This is separate from Supabase Auth's SMTP
// config — that only covers auth emails (confirm/reset/magic link), not
// emails our own app logic decides to send.
export async function sendReceiptEmail(params: {
  to: string;
  customerName: string;
  propertyName: string;
  address: string;
  planName: string;
  price: number;
  paymentMethod: string;
  transactionId: string;
  validFrom: string;
  validUntil: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping payment receipt email.');
    return { success: false };
  }

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;padding:40px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;border:1px solid #d2d2d7;overflow:hidden;">
      <div style="padding:32px 40px 0 40px;">
        <p style="margin:0;font-size:20px;font-weight:600;color:#1d1d1f;">Plot360</p>
      </div>
      <div style="padding:24px 40px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;color:#1d1d1f;">Payment Receipt</h1>
        <p style="margin:0 0 20px 0;font-size:15px;color:#6e6e73;">Hi ${params.customerName}, this confirms your payment has been verified and your property's subscription is active.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6e6e73;">Property</td><td style="padding:6px 0;text-align:right;">${params.propertyName}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Address</td><td style="padding:6px 0;text-align:right;">${params.address}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Plan</td><td style="padding:6px 0;text-align:right;">${params.planName}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Amount</td><td style="padding:6px 0;text-align:right;">₹${params.price}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Payment method</td><td style="padding:6px 0;text-align:right;">${params.paymentMethod}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Transaction ID</td><td style="padding:6px 0;text-align:right;">${params.transactionId}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Valid from</td><td style="padding:6px 0;text-align:right;">${params.validFrom}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Expires</td><td style="padding:6px 0;text-align:right;">${params.validUntil}</td></tr>
        </table>
      </div>
      <div style="padding:20px 40px;background:#f5f5f7;">
        <p style="margin:0;font-size:12px;color:#6e6e73;">Keep this email as your payment receipt. Contact support if anything looks incorrect.</p>
      </div>
    </div>
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Plot360 <noreply@plot360.in>',
        to: params.to,
        subject: `Payment Receipt — ${params.propertyName}`,
        html,
      }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
