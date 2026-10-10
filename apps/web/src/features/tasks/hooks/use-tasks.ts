import { useInfiniteQuery } from '@tanstack/react-query'
import { getTasks } from '@/features/tasks/api/tasks-api'
import type {
  PaginatedTasks,
  Task,
  TaskListFilters,
  TaskScope,
  TaskStatus,
} from '@/features/tasks/types/task.types'

export const taskQueryKeys = {
  all: (userId: string) => ['tasks', userId] as const,
  list: (userId: string, scope: TaskScope, status: TaskStatus, filters: TaskListFilters) =>
    ['tasks', userId, scope, status, filters] as const,
  summary: (userId: string, scope: TaskScope, filters: TaskListFilters) =>
    ['tasks', userId, 'summary', scope, filters] as const,
  details: (userId: string, taskId: string) => ['tasks', userId, 'details', taskId] as const,
}

export function getNextTaskPage(lastPage: { pagination: { page: number; totalPages: number } }): number | undefined {
  return lastPage.pagination.page < lastPage.pagination.totalPages
    ? lastPage.pagination.page + 1
    : undefined
}

export function useTasks({
  userId,
  scope,
  status,
  filters = {},
  enabled = true,
}: {
  userId: string | undefined
  scope: TaskScope
  status: TaskStatus
  filters?: TaskListFilters
  enabled?: boolean
}) {
  return useInfiniteQuery({
    queryKey: userId ? taskQueryKeys.list(userId, scope, status, filters) : ['tasks', 'disabled', scope, status, filters],
    queryFn: ({ pageParam }) => getTasks({ scope, status, page: pageParam, filters }),
    initialPageParam: 1,
    getNextPageParam: getNextTaskPage,
    enabled: Boolean(userId) && enabled,
  })
}

export function flattenTaskPages(pages: PaginatedTasks[] | undefined): Task[] {
  const tasks = pages?.flatMap((page) => page.data) ?? []
  return [...new Map(tasks.map((task) => [task.id, task])).values()]
}
