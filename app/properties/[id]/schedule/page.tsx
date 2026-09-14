import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getVisitCreditsForProperty, getOpenVisitRequestCounts } from '@/components/payments/visitCredits.actions';
import { remainingAfterReservations, nearestExpiry, canScheduleVisit } from '@/lib/visitCredits';
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

  const [credits, reservedCounts] = await Promise.all([getVisitCreditsForProperty(id), getOpenVisitRequestCounts([id])]);
  const reserved = reservedCounts[id] ?? 0;
  const gate = canScheduleVisit(property.status, credits);
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
      />
    </main>
  );
}
