'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Deletes a property and everything attached to it. DB cascade (see
// schema.sql) handles removing property_ownership, property_documents,
// tasks, payments, renewal_requests, monitoring_jobs and their media rows
// — but cascade only removes DATABASE rows, not the actual files sitting
// in storage, so those are explicitly collected and removed first.
export async function deletePropertyPermanently(propertyId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in.' };

  const { data: property } = await supabase
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .single();
  if (!property) return { error: 'Property not found.' };
  if (property.owner_id !== userData.user.id) return { error: 'Not authorized.' };

  const [{ data: docs }, { data: tasks }, { data: jobs }] = await Promise.all([
    supabase.from('property_documents').select('file_path').eq('property_id', propertyId),
    supabase.from('tasks').select('id').eq('property_id', propertyId),
    supabase.from('monitoring_jobs').select('id').eq('property_id', propertyId),
  ]);

  const taskIds = (tasks ?? []).map((t) => t.id);
  const jobIds = (jobs ?? []).map((j) => j.id);

  const [{ data: taskMedia }, { data: monitoringMedia }] = await Promise.all([
    taskIds.length > 0
      ? supabase.from('task_media').select('file_path').in('task_id', taskIds)
      : Promise.resolve({ data: [] }),
    jobIds.length > 0
      ? supabase.from('monitoring_media').select('file_path').in('job_id', jobIds)
      : Promise.resolve({ data: [] }),
  ]);

  await Promise.all([
    (docs ?? []).length > 0
      ? supabase.storage.from('property-documents').remove((docs ?? []).map((d) => d.file_path))
      : Promise.resolve(),
    (taskMedia ?? []).length > 0
      ? supabase.storage.from('task-media').remove((taskMedia ?? []).map((m) => m.file_path))
      : Promise.resolve(),
    (monitoringMedia ?? []).length > 0
      ? supabase.storage.from('monitoring-media').remove((monitoringMedia ?? []).map((m) => m.file_path))
      : Promise.resolve(),
  ]);

  const { error } = await supabase.from('properties').delete().eq('id', propertyId);
  if (error) return { error: error.message };

  redirect('/dashboard');
}
