import { Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatNotificationTime, getNotificationTypeLabel, isUnreadNotification } from '@/features/notifications/lib/notification-format'
import type { Notification } from '@/features/notifications/types/notification.types'

type NotificationItemProps = {
  notification: Notification
  onMarkRead: (id: string) => void
  isMarking: boolean
  compact?: boolean
  onNavigate?: () => void
}

export function NotificationItem({ notification, onMarkRead, isMarking, compact = false, onNavigate }: NotificationItemProps) {
  const unread = isUnreadNotification(notification)

  return (
    <li className={cn('rounded-2xl border p-4 transition-colors', unread ? 'border-blue-100 bg-blue-50/60' : 'border-slate-200 bg-white', compact && 'p-3')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-1 size-2 shrink-0 rounded-full', unread ? 'bg-blue-600' : 'bg-slate-300')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{getNotificationTypeLabel(notification.type)}</p><h3 className="mt-1 text-sm font-semibold text-slate-950">{notification.title}</h3></div>
            <time dateTime={notification.createdAt} className="shrink-0 text-xs text-slate-500">{formatNotificationTime(notification.createdAt)}</time>
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-600">{notification.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {notification.taskId && <Link to="/app/tasks" onClick={onNavigate} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Open taskboard<ExternalLink className="size-3" aria-hidden="true" /></Link>}
            {unread && <Button type="button" variant="ghost" size="sm" className="ml-auto" disabled={isMarking} onClick={() => onMarkRead(notification.id)}><Check aria-hidden="true" />{isMarking ? 'Saving…' : 'Mark read'}</Button>}
          </div>
        </div>
      </div>
    </li>
  )
}
