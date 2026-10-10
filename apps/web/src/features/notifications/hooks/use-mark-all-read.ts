import { useMutation } from '@tanstack/react-query'
import { markAllNotificationsRead } from '@/features/notifications/api/notifications-api'
import { invalidateNotificationQueries } from '@/features/notifications/lib/notification-query-invalidation'

export function useMarkAllRead(userId: string | undefined) {
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => invalidateNotificationQueries(userId),
  })
}
