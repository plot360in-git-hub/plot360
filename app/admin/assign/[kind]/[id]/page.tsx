import { redirect, notFound } from 'next/navigation';
import { getAdminGateStatus } from '@/components/admin/admin.actions';
import { AssignmentScreen } from '@/components/admin/AssignmentScreen';

export default async function AssignPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const gate = await getAdminGateStatus();
  if (gate === 'unauthenticated') redirect('/admin/login');
  if (gate === 'not_admin') redirect('/dashboard');

  const { kind, id } = await params;
  if (kind !== 'legacy' && kind !== 'visit_request' && kind !== 'stuck') notFound();

  return <AssignmentScreen kind={kind} id={id} />;
}
