'use client';

import { useEffect, useState, useTransition } from 'react';
import { sendPhoneVerificationCode, confirmPhoneVerificationCode } from './phoneVerification.actions';
import { toE164, looksLikePhoneNumber, samePhone } from '@/lib/phone';

// Redesign 2026-09 (follow-up, 2026-11-12) — phone verification. Shared
// by CustomerRegistrationForm.tsx (registration) and ProfileEditForm.tsx
// (changing an existing number later) — same WhatsApp-code flow either
// way, just a different reason the phone field in front of it changed.
//
// `verifiedE164` is how the parent tells this panel "treat this number
// as already verified, skip the OTP" — the onboarding form passes the
// signed-in user's current auth.users.phone (set already if they signed
// up via "Continue with WhatsApp OTP", which is itself a verified-phone
// signup), and the profile-edit form passes the number already saved on
// the profile (so editing your name doesn't suddenly demand you re-prove
// a phone number you verified when you first registered or last changed
// it). It only ever matches when the CURRENT field value normalizes to
// that same E.164 — change the number even by one digit and it reverts
// to needing a fresh code, exactly as it should.
export function PhoneVerifyPanel({
  phoneCountryCode,
  phoneNumber,
  verifiedE164,
  onVerifiedChange,
}: {
  phoneCountryCode: string;
  phoneNumber: string;
  verifiedE164?: string | null;
  onVerifiedChange: (verified: boolean) => void;
}) {
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [sentFor, setSentFor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifiedFor, setVerifiedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendPending, startSend] = useTransition();
  const [verifyPending, startVerify] = useTransition();

  const currentE164 = toE164(phoneCountryCode, phoneNumber);
  const validNumber = looksLikePhoneNumber(phoneNumber) && !!phoneCountryCode.trim();
  // verifiedE164 comes from the server (auth.users.phone), which may or
  // may not carry a leading "+" depending on Supabase/GoTrue version —
  // samePhone compares digits only so this doesn't matter; verifiedFor is
  // generated locally by the same toE164() call as currentE164, so a
  // plain match is fine there.
  const isVerified = validNumber && (samePhone(currentE164, verifiedE164) || currentE164 === verifiedFor);

  useEffect(() => {
    onVerifiedChange(isVerified);
    // Typing a different number than whatever was last sent a code to
    // should drop back to "not sent yet" rather than show a stale "enter
    // the code" box for a number that was never actually texted.
    if (!isVerified && stage === 'sent' && currentE164 !== sentFor) {
      setStage('idle');
      setCode('');
      setNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, currentE164]);

  function handleSend() {
    setError(null);
    setNotice(null);
    startSend(async () => {
      const result = await sendPhoneVerificationCode(phoneCountryCode, phoneNumber);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSentFor(currentE164);
      setStage('sent');
      setNotice(`Code sent via WhatsApp to ${phoneCountryCode} ${phoneNumber}.`);
    });
  }

  function handleVerify() {
    setError(null);
    startVerify(async () => {
      const result = await confirmPhoneVerificationCode(phoneCountryCode, phoneNumber, code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setVerifiedFor(currentE164);
      setStage('idle');
      setCode('');
      setNotice(null);
    });
  }

  if (isVerified) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-accent-700, var(--color-accent))', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden>✓</span> Verified via WhatsApp
      </p>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {stage === 'idle' && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ minHeight: 34, fontSize: 11.5, padding: '0 12px' }}
          disabled={!validNumber || sendPending}
          onClick={handleSend}
        >
          {sendPending ? 'Sending…' : 'Verify this number via WhatsApp'}
        </button>
      )}

      {stage === 'sent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notice && <p style={{ fontSize: 11.5, color: 'var(--p-ink-soft)' }}>{notice}</p>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ minHeight: 34, fontSize: 12, width: 140 }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 34, fontSize: 11.5, padding: '0 12px' }}
              disabled={!code.trim() || verifyPending}
              onClick={handleVerify}
            >
              {verifyPending ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 34, fontSize: 11.5, padding: '0 12px' }}
              disabled={sendPending}
              onClick={handleSend}
            >
              {sendPending ? 'Resending…' : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: 11.5, color: 'var(--p-alert)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
