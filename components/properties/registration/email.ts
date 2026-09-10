// Sent when admin verifies or rejects a property registration. Uses
// Resend's HTTP API directly, same pattern as the payment receipt email
// (see components/payments/email.ts) — separate from Supabase Auth's SMTP,
// which only covers auth emails.
export async function sendPropertyStatusEmail(params: {
  to: string;
  customerName: string;
  propertyName: string;
  address: string;
  status: 'verified' | 'rejected';
  rejectionReason?: string | null;
  siteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set — skipping property status email.');
    return { success: false };
  }

  const isVerified = params.status === 'verified';
  const heading = isVerified ? 'Your property has been verified' : 'Your property needs changes';
  const accent = isVerified ? '#1a7f37' : '#b3261e';
  const bodyText = isVerified
    ? 'Your property registration has been reviewed and verified. Log in to continue with subscription and payment to activate monitoring.'
    : "Your property registration was reviewed and couldn't be approved as submitted. See the admin's note below, then log in to make the needed changes and resubmit.";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;padding:40px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;border:1px solid #d2d2d7;overflow:hidden;">
      <div style="padding:32px 40px 0 40px;">
        <p style="margin:0;font-size:20px;font-weight:600;color:#1d1d1f;">Plot360</p>
      </div>
      <div style="padding:24px 40px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;color:${accent};">${heading}</h1>
        <p style="margin:0 0 16px 0;font-size:15px;color:#6e6e73;">Hi ${params.customerName},</p>
        <p style="margin:0 0 20px 0;font-size:15px;color:#1d1d1f;">${bodyText}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <tr><td style="padding:6px 0;color:#6e6e73;">Property</td><td style="padding:6px 0;text-align:right;">${params.propertyName}</td></tr>
          <tr><td style="padding:6px 0;color:#6e6e73;">Address</td><td style="padding:6px 0;text-align:right;">${params.address}</td></tr>
        </table>
        ${
          !isVerified && params.rejectionReason
            ? `<div style="background:#fff2f2;border:1px solid #f0c9c9;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
                 <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#b3261e;text-transform:uppercase;">Admin's note</p>
                 <p style="margin:0;font-size:14px;color:#1d1d1f;">${params.rejectionReason}</p>
               </div>`
            : ''
        }
        <a href="${params.siteUrl}" style="display:inline-block;padding:12px 28px;background:#7F7F7F;color:#fff;text-decoration:none;border-radius:980px;font-size:15px;">
          Log in to Plot360
        </a>
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
        subject: isVerified ? `Verified: ${params.propertyName}` : `Action needed: ${params.propertyName}`,
        html,
      }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
