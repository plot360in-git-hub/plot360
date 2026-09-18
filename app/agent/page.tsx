import { redirect } from 'next/navigation';

// Redesign 2026-09 (follow-up) — bare /agent 404'd because app/agent/
// only ever had subdirectories (dashboard, jobs, login, onboarding,
// profile, signup, auth), no root page.tsx. Plot: "if enter url
// .../agent ... it should take to login page but giving 404 error."
export default function AgentIndexPage() {
  redirect('/agent/login');
}
