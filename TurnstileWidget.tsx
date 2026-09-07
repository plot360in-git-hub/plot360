'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Renders Cloudflare's free CAPTCHA widget. The token it produces gets
// submitted as a hidden field named "cf-turnstile-response" (Turnstile's
// own convention) — the server action verifies that token with Cloudflare
// before treating the signup as legitimate.
export function TurnstileWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !containerRef.current) return;

    function renderWidget() {
      if (window.turnstile && containerRef.current) {
        window.turnstile.render(containerRef.current, { sitekey: siteKey });
      }
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', renderWidget);
    return () => script?.removeEventListener('load', renderWidget);
  }, []);

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-danger)' }}>
        Captcha not configured — set NEXT_PUBLIC_TURNSTILE_SITE_KEY.
      </p>
    );
  }

  return <div ref={containerRef} />;
}