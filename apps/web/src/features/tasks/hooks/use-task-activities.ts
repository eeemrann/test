import { useInfiniteQuery } from '@tanstack/react-query'
import { getTaskActivities } from '@/features/tasks/api/tasks-api'
import { taskQueryKeys } from '@/features/tasks/hooks/use-tasks'
import type { PaginatedTaskActivities } from '@/features/tasks/types/task.types'

export const ACTIVITY_PAGE_SIZE = 20

export function useTaskActivities({
  userId,
  taskId,
  enabled = true,
}: {
  userId: string | undefined
  taskId: string | null
  enabled?: boolean
}) {
  return useInfiniteQuery({
    queryKey: userId && taskId ? taskQueryKeys.activities(userId, taskId) : ['tasks', 'disabled', 'activities', taskId],
    queryFn: ({ pageParam }) => getTaskActivities(taskId as string, pageParam, ACTIVITY_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedTaskActivities) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    enabled: Boolean(userId && taskId) && enabled,
  })
}

export function flattenActivityPages(pages: PaginatedTaskActivities[] | undefined) {
  const activities = pages?.flatMap((page) => page.data) ?? []
  return [...new Map(activities.map((activity) => [activity.id, activity])).values()]
}
