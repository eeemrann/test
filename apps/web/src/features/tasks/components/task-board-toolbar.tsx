import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskScope } from '@/features/tasks/types/task.types'

type TaskBoardToolbarProps = {
  scope: TaskScope
  onScopeChange: (scope: TaskScope) => void
  onRefresh: () => void
  isRefreshing: boolean
}

export function TaskBoardToolbar({ scope, onScopeChange, onRefresh, isRefreshing }: TaskBoardToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Task scope" role="group">
        {(['all', 'mine'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => onScopeChange(value)}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              scope === value ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
            )}
          >
            {value === 'all' ? 'All Tasks' : 'My Tasks'}
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  )
}
