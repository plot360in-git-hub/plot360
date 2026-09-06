'use client';

import { useState, useTransition } from 'react';
import { saveCustomerRegistration } from './onboarding.actions';

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  'What city were you born in?',
  "What is your mother's maiden name?",
  'What was the name of your first school?',
];

function AddressFields({ prefix, label }: { prefix: 'current' | 'permanent'; label: string }) {
  return (
    <div>
      <h4 style={{ marginBottom: 12 }}>{label}</h4>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Street Address</label>
        <input className="field-input" name={`${prefix}_street`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label className="field-label">City</label>
          <input className="field-input" name={`${prefix}_city`} />
        </div>
        <div>
          <label className="field-label">State</label>
          <input className="field-input" name={`${prefix}_state`} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="field-label">Zip / Postal Code</label>
          <input className="field-input" name={`${prefix}_zip`} />
        </div>
        <div>
          <label className="field-label">Country</label>
          <select className="field-input" name={`${prefix}_country`} defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="IN">India</option>
            <option value="US">United States</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function CustomerRegistrationForm({ step: initialStep = 1 }: { step?: 1 | 2 }) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveCustomerRegistration(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: 16 }}>Registration complete — you're ready to add your first property.</p>
        <a href="/dashboard" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Customer Registration</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>Step {step} of 2</p>

      <div style={{ display: step === 1 ? 'block' : 'none' }}>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Username</label>
          <input className="field-input" name="username" required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="field-label">First name</label>
            <input className="field-input" name="first_name" required />
          </div>
          <div>
            <label className="field-label">Middle name</label>
            <input className="field-input" name="middle_name" />
          </div>
          <div>
            <label className="field-label">Last name</label>
            <input className="field-input" name="last_name" required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="field-label">Date of birth</label>
            <input className="field-input" type="date" name="date_of_birth" />
          </div>
          <div>
            <label className="field-label">Gender</label>
            <select className="field-input" name="gender" defaultValue="">
              <option value="" disabled>Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Profile picture (optional)</label>
          <input className="field-input" type="file" name="profile_picture" accept="image/*" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label className="field-label">Country code</label>
            <input className="field-input" name="phone_country_code" placeholder="+91" />
          </div>
          <div>
            <label className="field-label">Phone number</label>
            <input className="field-input" name="phone_number" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 16 }}>
          <AddressFields prefix="current" label="Current Address" />
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={sameAsCurrent}
                onChange={(e) => setSameAsCurrent(e.target.checked)}
              />
              Same as current address
            </label>
            {!sameAsCurrent && <AddressFields prefix="permanent" label="Permanent Address" />}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label className="field-label">Identity proof type</label>
            <select className="field-input" name="identity_proof_type" defaultValue="">
              <option value="" disabled>Select…</option>
              <option value="passport">Passport</option>
              <option value="drivers_license">Driver's License</option>
              <option value="national_id">National / Aadhar ID</option>
            </select>
          </div>
          <div>
            <label className="field-label">Identity proof upload</label>
            <input className="field-input" type="file" name="identity_proof" accept="image/*,.pdf" />
          </div>
        </div>

        <button type="button" className="btn-primary" onClick={() => setStep(2)}>
          Continue
        </button>
      </div>

      <div style={{ display: step === 2 ? 'block' : 'none' }}>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">How did you hear about us?</label>
          <input className="field-input" name="how_heard_about_us" />
        </div>

        <h4 style={{ marginBottom: 12 }}>Security questions</h4>
        {[1, 2].map((n) => (
          <div key={n} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="field-label">Question {n}</label>
              <select className="field-input" name={`security_question_${n}`} defaultValue="">
                <option value="" disabled>Select…</option>
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Answer</label>
              <input className="field-input" name={`security_answer_${n}`} />
            </div>
          </div>
        ))}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 8px', fontSize: 14 }}>
          <input type="checkbox" name="terms_accepted" required />
          I accept the Terms &amp; Conditions
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 14 }}>
          <input type="checkbox" name="privacy_accepted" required />
          I accept the Privacy Policy &amp; Agreements
        </label>

        {error && <p style={{ color: 'var(--color-danger)', marginBottom: 16 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn-primary" onClick={() => setStep(1)}>Back</button>
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </div>
    </form>
  );
}
