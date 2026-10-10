import { useQuery } from '@tanstack/react-query'
import { getUnreadCount } from '@/features/notifications/api/notifications-api'
import { notificationQueryKeys } from '@/features/notifications/lib/notification-query-keys'

export function useUnreadCount({ userId, enabled = true }: { userId: string | undefined; enabled?: boolean }) {
  return useQuery({
    queryKey: userId ? notificationQueryKeys.unreadCount(userId) : ['notifications', 'disabled', 'unread-count'],
    queryFn: getUnreadCount,
    enabled: Boolean(userId) && enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}
