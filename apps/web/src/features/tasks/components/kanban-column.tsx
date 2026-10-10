import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api'
import { TaskCard } from '@/features/tasks/components/task-card'
import type { Task, TaskStatus } from '@/features/tasks/types/task.types'

const emptyMessages: Record<TaskStatus, string> = {
  PENDING: 'No pending tasks',
  WORKING: 'No tasks in progress',
  DONE: 'No completed tasks yet',
}

type KanbanColumnProps = {
  status: TaskStatus
  title: string
  count: number | undefined
  tasks: Task[]
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRetry: () => void
  onSelectTask: (taskId: string) => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

export function KanbanColumn({
  title,
  count,
  tasks,
  isLoading,
  isFetching,
  error,
  onRetry,
  onSelectTask,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  status,
}: KanbanColumnProps) {
  return (
    <Card className="flex min-h-[28rem] min-w-[min(21rem,calc(100vw-2rem))] flex-1 flex-col border-slate-200/80 bg-slate-100/70 shadow-sm xl:min-w-0">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />
          {title}
          {count === undefined ? <Skeleton className="h-5 w-7 rounded-full" /> : <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">{count}</span>}
        </CardTitle>
        {isFetching && !isFetchingNextPage && <RefreshCw className="size-4 animate-spin text-slate-400" aria-label="Refreshing column" />}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-rose-200 bg-rose-50/60 p-5 text-center">
            <AlertCircle className="size-5 text-rose-600" aria-hidden="true" />
            <p className="text-sm font-medium text-rose-900">Could not load {title.toLowerCase()} tasks</p>
            <p className="text-xs leading-5 text-rose-800">{getApiErrorMessage(error)}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3" aria-label={`Loading ${title.toLowerCase()} tasks`}>
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
            <p className="text-sm text-slate-500">{emptyMessages[status]}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {tasks.map((task) => <TaskCard key={task.id} task={task} onSelect={onSelectTask} />)}
            </div>
            {hasNextPage && (
              <Button type="button" variant="outline" className="mt-auto w-full" onClick={onLoadMore} disabled={isFetchingNextPage}>
                <ChevronDown aria-hidden="true" />
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
