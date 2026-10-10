import { useMutation } from '@tanstack/react-query'
import { markNotificationRead } from '@/features/notifications/api/notifications-api'
import { invalidateNotificationQueries } from '@/features/notifications/lib/notification-query-invalidation'

export function useMarkNotificationRead(userId: string | undefined) {
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => invalidateNotificationQueries(userId),
  })
}
