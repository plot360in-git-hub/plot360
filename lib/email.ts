// Shared shell for all app-triggered notification emails (service request
// replies, renewal approvals, payment acknowledgments, etc.) — keeps one
// branded template instead of duplicating HTML in every call site. Uses
// Resend's HTTP API directly, separate from Supabase Auth's SMTP.
export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  heading: string;
  bodyLines: string[];
  ctaText?: string;
  ctaUrl?: string;
  accent?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`RESEND_API_KEY not set — skipping email "${params.subject}".`);
    return { success: false };
  }

  const accent = params.accent || '#1d1d1f';
  const paragraphs = params.bodyLines.map((line) => `<p style="margin:0 0 14px 0;font-size:15px;color:#1d1d1f;">${line}</p>`).join('');
  const cta = params.ctaText && params.ctaUrl
    ? `<a href="${params.ctaUrl}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:#7F7F7F;color:#fff;text-decoration:none;border-radius:980px;font-size:15px;">${params.ctaText}</a>`
    : '';

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;padding:40px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;border:1px solid #d2d2d7;overflow:hidden;">
      <div style="padding:32px 40px 0 40px;">
        <p style="margin:0;font-size:20px;font-weight:600;color:#1d1d1f;">Plot360</p>
      </div>
      <div style="padding:24px 40px 32px 40px;">
        <h1 style="margin:0 0 16px 0;font-size:22px;color:${accent};">${params.heading}</h1>
        ${paragraphs}
        ${cta}
      </div>
    </div>
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Plot360 <noreply@plot360.in>', to: params.to, subject: params.subject, html }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
