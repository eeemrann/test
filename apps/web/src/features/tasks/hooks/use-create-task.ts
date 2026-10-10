import { useMutation } from '@tanstack/react-query'
import { createTask } from '@/features/tasks/api/tasks-api'
import { invalidateTaskQueries } from '@/features/tasks/lib/task-query-invalidation'
import type { CreateTaskInput } from '@/features/tasks/types/task.types'

export function useCreateTask(userId: string | undefined) {
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => invalidateTaskQueries(userId),
    onError: () => invalidateTaskQueries(userId),
  })
}
