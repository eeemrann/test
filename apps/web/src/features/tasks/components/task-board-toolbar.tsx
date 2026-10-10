import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { flattenAssignableUsers, useAssignableUsers } from '@/features/tasks/hooks/use-assignable-users'
import { toApiDateBoundary, toDateInputValue } from '@/features/tasks/task-format'
import { TASK_PRIORITIES, TASK_SORT_FIELDS, TASK_SORT_ORDERS } from '@/features/tasks/types/task.types'
import type { TaskListFilters, TaskScope, TaskSortField, TaskSortOrder } from '@/features/tasks/types/task.types'

type TaskBoardToolbarProps = {
  scope: TaskScope
  userId: string | undefined
  filters: TaskListFilters
  searchValue: string
  onSearchChange: (value: string) => void
  onScopeChange: (scope: TaskScope) => void
  onFiltersChange: (filters: TaskListFilters) => void
  onClearFilters: () => void
  onRefresh: () => void
  isRefreshing: boolean
  filterError: string | null
}

const inputClassName = 'h-9 border-slate-200 bg-white text-sm'

export function TaskBoardToolbar({
  scope,
  userId,
  filters,
  searchValue,
  onSearchChange,
  onScopeChange,
  onFiltersChange,
  onClearFilters,
  onRefresh,
  isRefreshing,
  filterError,
}: TaskBoardToolbarProps) {
  const usersQuery = useAssignableUsers({ userId, enabled: scope === 'all' })
  const assignableUsers = useMemo(() => flattenAssignableUsers(usersQuery.data?.pages), [usersQuery.data?.pages])
  const hasFilters = Boolean(searchValue || filters.priority || filters.assignedToId || filters.deadlineFrom || filters.deadlineTo || filters.overdue !== undefined || filters.sortBy || filters.sortOrder)

  const updateFilter = <K extends keyof TaskListFilters>(key: K, value: TaskListFilters[K] | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm" aria-label="Taskboard filters">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
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
        <div className="flex gap-2">
          {hasFilters && <Button type="button" variant="ghost" onClick={onClearFilters}><X aria-hidden="true" />Clear filters</Button>}
          <Button type="button" variant="outline" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative md:col-span-2 xl:col-span-2">
          <span className="sr-only">Search tasks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search task titles and descriptions" className={cn(inputClassName, 'pl-9')} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Priority</span>
          <select aria-label="Filter by priority" value={filters.priority ?? ''} onChange={(event) => updateFilter('priority', event.target.value as TaskListFilters['priority'])} className={cn(inputClassName, 'w-full rounded-lg px-2.5')}>
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Assignee</span>
          <select aria-label="Filter by assignee" disabled={scope === 'mine' || usersQuery.isLoading} value={scope === 'mine' ? '' : filters.assignedToId ?? ''} onChange={(event) => updateFilter('assignedToId', event.target.value)} className={cn(inputClassName, 'w-full rounded-lg px-2.5')}>
            <option value="">{scope === 'mine' ? 'My assigned tasks' : usersQuery.isLoading ? 'Loading employees…' : 'All assignees'}</option>
            {assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Deadline from</span>
          <Input type="date" value={toDateInputValue(filters.deadlineFrom)} onChange={(event) => updateFilter('deadlineFrom', toApiDateBoundary(event.target.value))} className={inputClassName} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Deadline to</span>
          <Input type="date" value={toDateInputValue(filters.deadlineTo)} onChange={(event) => updateFilter('deadlineTo', toApiDateBoundary(event.target.value, true))} className={inputClassName} />
        </label>
        <label className="flex items-end gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={filters.overdue === true} onChange={(event) => updateFilter('overdue', event.target.checked ? true : undefined)} className="size-4 accent-blue-600" />
          Overdue only
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Sort by</span>
          <select aria-label="Sort tasks by" value={filters.sortBy ?? 'createdAt'} onChange={(event) => updateFilter('sortBy', event.target.value as TaskSortField)} className={cn(inputClassName, 'w-full rounded-lg px-2.5')}>
            {TASK_SORT_FIELDS.map((field) => <option key={field} value={field}>{field === 'createdAt' ? 'Created' : field === 'updatedAt' ? 'Updated' : 'Deadline'}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Order</span>
          <select aria-label="Sort order" value={filters.sortOrder ?? 'desc'} onChange={(event) => updateFilter('sortOrder', event.target.value as TaskSortOrder)} className={cn(inputClassName, 'w-full rounded-lg px-2.5')}>
            {TASK_SORT_ORDERS.map((order) => <option key={order} value={order}>{order === 'asc' ? 'Ascending' : 'Descending'}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500"><SlidersHorizontal className="size-3.5" aria-hidden="true" />Summary counts use the same compatible filters; sorting changes task order only.</div>
      {filterError && <p role="alert" className="text-sm font-medium text-rose-700">{filterError}</p>}
    </section>
  )
}
