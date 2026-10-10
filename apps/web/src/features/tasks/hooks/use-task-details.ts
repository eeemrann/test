import { useQuery } from '@tanstack/react-query'
import { getTaskById } from '@/features/tasks/api/tasks-api'
import { taskQueryKeys } from '@/features/tasks/hooks/use-tasks'

export function useTaskDetails({
  userId,
  taskId,
  enabled = true,
}: {
  userId: string | undefined
  taskId: string | null
  enabled?: boolean
}) {
  return useQuery({
    queryKey: userId && taskId ? taskQueryKeys.details(userId, taskId) : ['tasks', 'disabled', 'details', taskId],
    queryFn: () => getTaskById(taskId!),
    enabled: Boolean(userId && taskId) && enabled,
  })
}
