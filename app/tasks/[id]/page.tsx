import { getTaskWithMedia } from '@/components/tasks/tasks.actions';
import { isCurrentUserAdmin } from '@/components/admin/admin.actions';
import { TaskMediaGallery } from '@/components/tasks/TaskMediaGallery';

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ task, media }, isAdmin] = await Promise.all([getTaskWithMedia(id), isCurrentUserAdmin()]);
  if (!task) return <p className="container-narrow">Task not found.</p>;
  return <TaskMediaGallery task={task} media={media} readOnly={!isAdmin} />;
}
