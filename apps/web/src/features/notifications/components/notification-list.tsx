import { NotificationItem } from '@/features/notifications/components/notification-item'
import type { Notification } from '@/features/notifications/types/notification.types'

type NotificationListProps = {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  markingId: string | null
  compact?: boolean
  onNavigate?: () => void
}

export function NotificationList({ notifications, onMarkRead, markingId, compact = false, onNavigate }: NotificationListProps) {
  return <ul className="space-y-3" aria-label="Notifications">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} onMarkRead={onMarkRead} isMarking={markingId === notification.id} compact={compact} onNavigate={onNavigate} />)}</ul>
}
