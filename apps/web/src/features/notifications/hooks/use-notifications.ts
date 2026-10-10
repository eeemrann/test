import { useInfiniteQuery } from '@tanstack/react-query'
import { getNotifications, NOTIFICATION_PAGE_SIZE } from '@/features/notifications/api/notifications-api'
import { notificationQueryKeys } from '@/features/notifications/lib/notification-query-keys'
import type { PaginatedNotifications, Notification } from '@/features/notifications/types/notification.types'

export function useNotifications({
  userId,
  unreadOnly = false,
  limit = NOTIFICATION_PAGE_SIZE,
  enabled = true,
}: {
  userId: string | undefined
  unreadOnly?: boolean
  limit?: number
  enabled?: boolean
}) {
  return useInfiniteQuery({
    queryKey: userId ? notificationQueryKeys.list(userId, unreadOnly, limit) : ['notifications', 'disabled', unreadOnly, limit],
    queryFn: ({ pageParam }) => getNotifications({ page: pageParam, limit, unreadOnly }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedNotifications) => lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    enabled: Boolean(userId) && enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function flattenNotificationPages(pages: PaginatedNotifications[] | undefined): Notification[] {
  const notifications = pages?.flatMap((page) => page.data) ?? []
  return [...new Map(notifications.map((notification) => [notification.id, notification])).values()]
}
