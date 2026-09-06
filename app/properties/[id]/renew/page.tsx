import { createClient } from '@/lib/supabase/server';
import { RequestRenewalForm } from '@/components/properties/renewal/RequestRenewalForm';
import { getPendingRenewalForProperty } from '@/components/properties/renewal/renewal.actions';

export default async function RenewPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: property }, pending] = await Promise.all([
    supabase.from('properties').select('property_name, status, expiration_date').eq('id', id).single(),
    getPendingRenewalForProperty(id),
  ]);

  if (!property) return <p className="container-narrow">Property not found.</p>;

  if (property.status !== 'verified') {
    return (
      <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p>Only verified properties can be renewed. This one is currently {property.status}.</p>
        </div>
      </main>
    );
  }

  if (!property.expiration_date) {
    return (
      <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p>This property doesn't have an active payment period yet — check the Payment section on the property page.</p>
        </div>
      </main>
    );
  }

  const daysUntilExpiry = Math.ceil((new Date(property.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const { data: latestPayment } = await supabase
    .from('payments')
    .select('valid_from')
    .eq('property_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let visitsCompleted = 0;
  if (latestPayment?.valid_from) {
    const { count } = await supabase
      .from('monitoring_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id)
      .eq('status', 'approved')
      .gte('decided_at', latestPayment.valid_from);
    visitsCompleted = count ?? 0;
  }

  if (visitsCompleted < 2 || daysUntilExpiry > 15) {
    return (
      <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p>
            Renewal isn't available yet. It unlocks once both twice-yearly site verifications are
            complete ({visitsCompleted}/2 done) and your listing is within 15 days of expiring
            {daysUntilExpiry > 15 ? ` (currently ${daysUntilExpiry} days away)` : ''}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <RequestRenewalForm
        propertyId={id}
        propertyName={property.property_name}
        currentExpiration={property.expiration_date}
        alreadyPending={!!pending}
      />
    </main>
  );
}
