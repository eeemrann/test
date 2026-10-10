import { useMutation } from '@tanstack/react-query'
import { updateTask } from '@/features/tasks/api/tasks-api'
import { invalidateTaskQueries } from '@/features/tasks/lib/task-query-invalidation'
import type { UpdateTaskInput } from '@/features/tasks/types/task.types'

export function useUpdateTask(userId: string | undefined) {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => updateTask(id, input),
    onSuccess: () => invalidateTaskQueries(userId),
    onError: () => invalidateTaskQueries(userId),
  })
}
