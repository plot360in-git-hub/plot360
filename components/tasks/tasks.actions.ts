'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Local admin check (kept self-contained in this module rather than
// importing from components/admin, per the "independent module" pattern —
// tasks shouldn't depend on the admin feature folder to function).
async function requireAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false as const, error: 'Not signed in.' };
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userData.user.id).single();
  if (!profile?.is_admin) return { ok: false as const, error: 'Only an admin can do this.' };
  return { ok: true as const, supabase };
}

export async function getAllTasksForCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select('*, properties(id, property_name)')
    .order('start_date', { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function getTasksForProperty(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('property_id', propertyId)
    .order('start_date', { ascending: true });
  return data ?? [];
}

// Admin-only: customers get read-only visibility into tasks (status,
// progress, media) but cannot create, update, or delete them. RLS already
// enforces this (tasks_insert_admin etc.) — this check exists so a
// non-admin sees a clean error instead of a raw Postgres RLS failure.
export async function createTask(propertyId: string, formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from('tasks').insert({
    property_id: propertyId,
    task_name: String(formData.get('task_name') || ''),
    task_type: String(formData.get('task_type') || '') || null,
    start_date: String(formData.get('start_date') || '') || null,
    notes: String(formData.get('notes') || '') || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/admin/${propertyId}`);
  return { success: true };
}

export async function getTaskWithMedia(taskId: string) {
  const supabase = await createClient();
  const [{ data: task }, { data: media }] = await Promise.all([
    supabase.from('tasks').select('*, properties(property_name)').eq('id', taskId).single(),
    supabase.from('task_media').select('*').eq('task_id', taskId).order('uploaded_at', { ascending: true }),
  ]);
  return { task, media: media ?? [] };
}

export async function updateTaskStatus(taskId: string, status: 'not_done' | 'in_progress' | 'complete') {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const patch: Record<string, unknown> = { status };
  if (status === 'complete') patch.completed_date = new Date().toISOString().slice(0, 10);
  const { error } = await gate.supabase.from('tasks').update(patch).eq('id', taskId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

// Handles the "Pic1..Pic12 + Video player" grid from the Task View wireframe.
export async function uploadTaskMedia(taskId: string, formData: FormData) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const supabase = gate.supabase;

  const files = formData.getAll('media') as File[];
  if (files.length === 0) return { error: 'No files selected.' };

  for (const file of files) {
    if (file.size === 0) continue;
    const path = `${taskId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('task-media').upload(path, file);
    if (uploadError) return { error: uploadError.message };

    const mediaType = file.type.startsWith('video') ? 'video' : 'photo';
    const { error: insertError } = await supabase
      .from('task_media')
      .insert({ task_id: taskId, media_type: mediaType, file_path: path });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/tasks/${taskId}`);
  return { success: true };
}

export async function deleteTask(taskId: string, propertyId: string) {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const { error } = await gate.supabase.from('tasks').delete().eq('id', taskId);
  if (error) return { error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  revalidatePath(`/admin/${propertyId}`);
  return { success: true };
}
