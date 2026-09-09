import { PropertyView } from '@/components/properties/view/PropertyView';
import { TaskList } from '@/components/tasks/TaskList';
import { MonitoringStatus } from '@/components/properties/monitoring/MonitoringStatus';

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <PropertyView propertyId={id} />
      <div className="container-wide" style={{ paddingBottom: 60 }}>
        <MonitoringStatus propertyId={id} />
        <TaskList propertyId={id} />
      </div>
    </main>
  );
}
