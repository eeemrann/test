import { useMutation } from '@tanstack/react-query'
import { reassignTask } from '@/features/tasks/api/tasks-api'
import { invalidateTaskQueries } from '@/features/tasks/lib/task-query-invalidation'
import type { ReassignTaskInput } from '@/features/tasks/types/task.types'

export function useReassignTask(userId: string | undefined) {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReassignTaskInput }) => reassignTask(id, input),
    onSuccess: () => invalidateTaskQueries(userId),
    onError: () => invalidateTaskQueries(userId),
  })
}
