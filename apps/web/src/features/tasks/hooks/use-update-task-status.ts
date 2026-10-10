import { useMutation } from '@tanstack/react-query'
import { updateTaskStatus } from '@/features/tasks/api/tasks-api'
import { invalidateTaskQueries } from '@/features/tasks/lib/task-query-invalidation'
import type { UpdateTaskStatusInput } from '@/features/tasks/types/task.types'

export function useUpdateTaskStatus(userId: string | undefined) {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskStatusInput }) => updateTaskStatus(id, input),
    onSuccess: () => invalidateTaskQueries(userId),
    onError: () => invalidateTaskQueries(userId),
  })
}
