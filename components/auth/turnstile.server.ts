// Verifies a Turnstile token against Cloudflare's API. Must run server-side
// only — uses the secret key, which must never reach the browser.
export async function verifyTurnstileToken(token: string | null, remoteIp?: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // Fails safe: if the secret isn't configured, don't silently allow
    // every signup through — flag it clearly so it gets fixed in setup.
    return { success: false, error: 'Captcha is not configured on the server (missing TURNSTILE_SECRET_KEY).' };
  }
  if (!token) {
    return { success: false, error: 'Please complete the captcha.' };
  }

  const body = new URLSearchParams();
  body.append('secret', secretKey);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    if (!data.success) {
      return { success: false, error: 'Captcha verification failed. Please try again.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Could not verify captcha right now. Please try again.' };
  }
}
