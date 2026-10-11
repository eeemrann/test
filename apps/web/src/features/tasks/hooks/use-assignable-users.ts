import { useInfiniteQuery } from '@tanstack/react-query'
import { getAssignableUsers } from '@/features/tasks/api/tasks-api'
import type { AssignableUser } from '@/features/tasks/types/task.types'

const ASSIGNABLE_USERS_PAGE_SIZE = 100

export function useAssignableUsers({
  userId,
  search = '',
  purpose = 'create',
  enabled = true,
}: {
  userId: string | undefined
  search?: string
  purpose?: 'create' | 'reassign'
  enabled?: boolean
}) {
  return useInfiniteQuery({
    queryKey: ['assignable-users', userId, search, purpose],
    queryFn: ({ pageParam }) => getAssignableUsers({ page: pageParam, limit: ASSIGNABLE_USERS_PAGE_SIZE, search: search || undefined, purpose }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: Boolean(userId) && enabled,
  })
}

export function flattenAssignableUsers(pages: Array<{ data: AssignableUser[] }> | undefined): AssignableUser[] {
  const users = pages?.flatMap((page) => page.data) ?? []
  return [...new Map(users.map((user) => [user.id, user])).values()]
}
