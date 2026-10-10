import { AlertCircle, Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/layouts/components/page-header'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useMarkAllRead } from '@/features/notifications/hooks/use-mark-all-read'
import { useMarkNotificationRead } from '@/features/notifications/hooks/use-mark-notification-read'
import { flattenNotificationPages, useNotifications } from '@/features/notifications/hooks/use-notifications'
import { getNotificationMutationErrorMessage } from '@/features/notifications/lib/notification-errors'
import { getApiErrorMessage } from '@/lib/api'
import { NotificationEmptyState } from '@/features/notifications/components/notification-empty-state'
import { NotificationList } from '@/features/notifications/components/notification-list'

type NotificationFilter = 'all' | 'unread'

export function NotificationsPage() {
  const auth = useAuth()
  const userId = auth.currentUser?.id
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const notificationsQuery = useNotifications({ userId, unreadOnly: filter === 'unread', enabled: auth.isAuthenticated })
  const markRead = useMarkNotificationRead(userId)
  const markAll = useMarkAllRead(userId)
  const notifications = flattenNotificationPages(notificationsQuery.data?.pages)
  const actionError = markRead.error ?? markAll.error

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Personal workspace" title="Notifications" description="Review private task and workspace updates delivered to your account." icon={Bell} action={<Button type="button" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck aria-hidden="true" />{markAll.isPending ? 'Marking…' : 'Mark all read'}</Button>} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Notification filter">
          {(['all', 'unread'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filter === value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{value === 'all' ? 'All' : 'Unread'}</button>)}
        </div>
        {notificationsQuery.data && <p className="text-sm text-slate-500">{notificationsQuery.data.pages[0]?.pagination.total ?? 0} {filter === 'unread' ? 'unread ' : ''}notification{(notificationsQuery.data.pages[0]?.pagination.total ?? 0) === 1 ? '' : 's'}</p>}
      </div>
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{getNotificationMutationErrorMessage(actionError)}</p>}
      {notificationsQuery.isLoading ? <Card><CardContent className="space-y-3 p-4"><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-28 w-full rounded-2xl" /><Skeleton className="h-28 w-full rounded-2xl" /></CardContent></Card> : notificationsQuery.error ? <Card className="border-rose-200 bg-rose-50"><CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" /><div><p className="font-medium text-rose-900">Notifications are unavailable</p><p className="mt-1 text-sm text-rose-800">{getApiErrorMessage(notificationsQuery.error)}</p></div></div><Button type="button" variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}><RefreshCw aria-hidden="true" />Retry</Button></CardContent></Card> : notifications.length === 0 ? <NotificationEmptyState unreadOnly={filter === 'unread'} /> : <><NotificationList notifications={notifications} onMarkRead={(id) => markRead.mutate(id)} markingId={markRead.isPending ? markRead.variables ?? null : null} />{notificationsQuery.hasNextPage && <Button type="button" variant="outline" className="w-full" onClick={() => void notificationsQuery.fetchNextPage()} disabled={notificationsQuery.isFetchingNextPage}>{notificationsQuery.isFetchingNextPage ? 'Loading…' : 'Load more notifications'}</Button>}</>}
    </div>
  )
}
