import { AlertCircle, CheckCircle2, CircleDashed, Clock3, ListTodo, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api'
import type { TaskSummary as TaskSummaryData } from '@/features/tasks/types/task.types'

type TaskSummaryProps = {
  summary: TaskSummaryData | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export function TaskSummary({ summary, isLoading, error, onRetry }: TaskSummaryProps) {
  if (error) {
    return (
      <Card className="border-rose-200 bg-rose-50/70">
        <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-rose-900">Task summary is unavailable</p>
              <p className="mt-1 text-sm text-rose-800">{getApiErrorMessage(error)}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />Retry summary
          </Button>
        </CardContent>
      </Card>
    )
  }

  const items = [
    { label: 'Total tasks', value: summary?.total, icon: ListTodo, tone: 'text-slate-600 bg-slate-100' },
    { label: 'Pending', value: summary?.pending, icon: CircleDashed, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Working', value: summary?.working, icon: Clock3, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Completed', value: summary?.done, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Overdue', value: summary?.overdue, icon: AlertCircle, tone: 'text-rose-700 bg-rose-50' },
  ] as const

  return (
    <section aria-label="Task summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              {isLoading ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="text-xl font-semibold text-slate-950">{value ?? '—'}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
