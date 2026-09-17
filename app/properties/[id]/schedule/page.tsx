import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getVisitCreditsForProperty, getReservedCreditCounts } from '@/components/payments/visitCredits.actions';
import { remainingAfterReservations, nearestExpiry, canScheduleVisit } from '@/lib/visitCredits';
import { maskPhone } from '@/components/customer/home.data';
import { ScheduleVisit } from '@/components/customer/ScheduleVisit';

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: property } = await supabase
    .from('properties')
    .select('id, property_name, status, owner_id')
    .eq('id', id)
    .single();
  if (!property || property.owner_id !== userData.user.id) redirect('/dashboard');

  const [credits, reservedCounts, { data: profile }, { count: jobCount }] = await Promise.all([
    getVisitCreditsForProperty(id),
    getReservedCreditCounts([id]),
    supabase.from('profiles').select('phone_number').eq('id', userData.user.id).maybeSingle(),
    // Redesign 2026-09 (follow-up, round 19) — gates this whole screen:
    // the first visit is arranged automatically (see canScheduleVisit's
    // own note), so this only unlocks once at least one monitoring_jobs
    // row already exists for the property.
    supabase.from('monitoring_jobs').select('id', { count: 'exact', head: true }).eq('property_id', id),
  ]);
  const reserved = reservedCounts[id] ?? 0;
  const gate = canScheduleVisit(property.status, credits, (jobCount ?? 0) > 0);
  const remaining = remainingAfterReservations(credits, reserved);
  const expiry = nearestExpiry(credits);

  return (
    <main>
      <ScheduleVisit
        propertyId={id}
        propertyName={property.property_name}
        eligible={gate.eligible}
        hasCredits={gate.hasCredits && remaining > 0}
        reason={gate.reason}
        creditsRemaining={remaining}
        expiresAt={expiry ? expiry.toISOString().slice(0, 10) : null}
        maskedPhone={maskPhone(profile?.phone_number)}
      />
    </main>
  );
}
