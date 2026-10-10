import { useQuery } from '@tanstack/react-query'
import { getTaskSummary } from '@/features/tasks/api/tasks-api'
import { taskQueryKeys } from '@/features/tasks/hooks/use-tasks'
import type { TaskScope, TaskSummaryFilters } from '@/features/tasks/types/task.types'

export function useTaskSummary({
  userId,
  scope,
  filters = {},
  enabled = true,
}: {
  userId: string | undefined
  scope: TaskScope
  filters?: TaskSummaryFilters
  enabled?: boolean
}) {
  return useQuery({
    queryKey: userId ? taskQueryKeys.summary(userId, scope, filters) : ['tasks', 'disabled', 'summary', scope, filters],
    queryFn: () => getTaskSummary(scope, filters),
    enabled: Boolean(userId) && enabled,
  })
}
