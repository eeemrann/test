import { AlertCircle, CheckCheck, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api'
import { useMarkAllRead } from '@/features/notifications/hooks/use-mark-all-read'
import { useMarkNotificationRead } from '@/features/notifications/hooks/use-mark-notification-read'
import { flattenNotificationPages, useNotifications } from '@/features/notifications/hooks/use-notifications'
import { getNotificationMutationErrorMessage } from '@/features/notifications/lib/notification-errors'
import { NotificationEmptyState } from '@/features/notifications/components/notification-empty-state'
import { NotificationList } from '@/features/notifications/components/notification-list'

type NotificationPopoverProps = {
  userId: string
  onClose: () => void
}

export function NotificationPopover({ userId, onClose }: NotificationPopoverProps) {
  const notificationsQuery = useNotifications({ userId, limit: 5, enabled: true })
  const markRead = useMarkNotificationRead(userId)
  const markAll = useMarkAllRead(userId)
  const notifications = flattenNotificationPages(notificationsQuery.data?.pages)
  const actionError = markRead.error ?? markAll.error

  return (
    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10" role="dialog" aria-label="Recent notifications">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-semibold text-slate-950">Recent notifications</h2><p className="text-xs text-slate-500">Your latest workspace updates</p></div><Button type="button" variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck aria-hidden="true" />{markAll.isPending ? 'Saving…' : 'Mark all read'}</Button></div>
      <div className="max-h-[min(32rem,70vh)] overflow-y-auto p-3">
        {notificationsQuery.isLoading ? <div className="space-y-3" aria-label="Loading notifications"><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-28 w-full rounded-2xl" /></div> : notificationsQuery.error ? <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden="true" /><p>{getApiErrorMessage(notificationsQuery.error)}</p></div><Button type="button" variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}><RefreshCw aria-hidden="true" />Retry</Button></div> : notifications.length === 0 ? <NotificationEmptyState /> : <NotificationList notifications={notifications} onMarkRead={(id) => markRead.mutate(id)} markingId={markRead.isPending ? markRead.variables ?? null : null} compact onNavigate={onClose} />}
        {actionError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{getNotificationMutationErrorMessage(actionError)}</p>}
      </div>
      <div className="border-t border-slate-100 bg-slate-50/70 p-3"><Link to="/app/notifications" onClick={onClose} className="flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">View all notifications</Link></div>
    </div>
  )
}
