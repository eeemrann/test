import { AlertCircle, History, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api'
import { useTaskActivities, flattenActivityPages } from '@/features/tasks/hooks/use-task-activities'
import { describeTaskActivity, formatActivityTimestamp } from '@/features/tasks/activity-format'

type ActivityTimelineProps = {
  userId: string | undefined
  taskId: string
}

export function ActivityTimeline({ userId, taskId }: ActivityTimelineProps) {
  const activitiesQuery = useTaskActivities({ userId, taskId })
  const activities = flattenActivityPages(activitiesQuery.data?.pages)

  return (
    <section className="space-y-3 border-t border-slate-100 pt-5" aria-label="Task activity history">
      <div className="flex items-center gap-2"><History className="size-4 text-blue-700" aria-hidden="true" /><h3 className="text-sm font-semibold text-slate-950">Activity</h3></div>
      {activitiesQuery.isLoading ? (
        <div className="space-y-3" aria-label="Loading task activity"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
      ) : activitiesQuery.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden="true" /><p>{getApiErrorMessage(activitiesQuery.error)}</p></div>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void activitiesQuery.refetch()}><RefreshCw aria-hidden="true" />Retry</Button>
        </div>
      ) : activities.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No activity yet.</p>
      ) : (
        <>
          <ol className="space-y-3" aria-label="Task activity entries">
            {activities.map((activity) => {
              const presentation = describeTaskActivity(activity)
              return (
                <li key={activity.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-medium text-slate-900">{presentation.label}</p>{presentation.detail && <p className="mt-1 text-sm text-slate-600">{presentation.detail}</p>}</div>
                    <time dateTime={activity.createdAt} className="shrink-0 text-right text-xs text-slate-500">{formatActivityTimestamp(activity.createdAt)}</time>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">By {activity.actor?.fullName ?? 'Unknown actor'}</p>
                </li>
              )
            })}
          </ol>
          {activitiesQuery.hasNextPage && <Button type="button" variant="outline" className="w-full" onClick={() => void activitiesQuery.fetchNextPage()} disabled={activitiesQuery.isFetchingNextPage}>{activitiesQuery.isFetchingNextPage ? 'Loading…' : 'Load more activity'}</Button>}
        </>
      )}
    </section>
  )
}
