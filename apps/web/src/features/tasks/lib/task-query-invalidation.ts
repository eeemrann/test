import { queryClient } from '@/lib/query-client'
import { taskQueryKeys } from '@/features/tasks/hooks/use-tasks'

export function invalidateTaskQueries(userId: string | undefined): Promise<void> {
  if (!userId) return Promise.resolve()
  return queryClient.invalidateQueries({ queryKey: taskQueryKeys.all(userId) }).then(() => undefined)
}
