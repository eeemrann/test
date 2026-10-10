import { queryClient } from '@/lib/query-client'
import { notificationQueryKeys } from '@/features/notifications/lib/notification-query-keys'

export function invalidateNotificationQueries(userId: string | undefined): Promise<void> {
  if (!userId) return Promise.resolve()
  return queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(userId) }).then(() => undefined)
}
