import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ClipboardList } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { PageHeader } from '@/layouts/components/page-header'
import { taskQueryKeys, flattenTaskPages, useTasks } from '@/features/tasks/hooks/use-tasks'
import { useTaskSummary } from '@/features/tasks/hooks/use-task-summary'
import { useUpdateTaskStatus } from '@/features/tasks/hooks/use-update-task-status'
import { KanbanColumn } from '@/features/tasks/components/kanban-column'
import { TaskBoardToolbar } from '@/features/tasks/components/task-board-toolbar'
import { TaskDetailsDialog } from '@/features/tasks/components/task-details-dialog'
import { TaskSummary } from '@/features/tasks/components/task-summary'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { TaskActionFeedback } from '@/features/tasks/components/task-action-feedback'
import { TaskDragPreview } from '@/features/tasks/components/task-card'
import { canCreateTask, canDragTask, canDropTask } from '@/features/tasks/lib/task-permissions'
import { getTaskMutationErrorMessage } from '@/features/tasks/task-errors'
import { getDeadlineRangeError } from '@/features/tasks/task-format'
import type { Task, TaskListFilters, TaskScope, TaskStatus } from '@/features/tasks/types/task.types'
import { queryClient } from '@/lib/query-client'

const columns: readonly { status: TaskStatus; title: string; summaryKey: 'pending' | 'working' | 'done' }[] = [
  { status: 'PENDING', title: 'Pending', summaryKey: 'pending' },
  { status: 'WORKING', title: 'Working', summaryKey: 'working' },
  { status: 'DONE', title: 'Done', summaryKey: 'done' },
]

const statusLabels: Record<TaskStatus, string> = { PENDING: 'Pending', WORKING: 'Working', DONE: 'Done' }

export function TaskBoard() {
  const auth = useAuth()
  const [scope, setScope] = useState<TaskScope>('all')
  const [filters, setFilters] = useState<TaskListFilters>({})
  const [searchDraft, setSearchDraft] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  const userId = auth.currentUser?.id
  const updateStatus = useUpdateTaskStatus(userId)
  const dragBusy = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: searchDraft.trim() || undefined }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const filterError = getDeadlineRangeError(filters.deadlineFrom, filters.deadlineTo)
  const summaryFilters = useMemo(() => ({
    priority: filters.priority,
    search: filters.search,
    overdue: filters.overdue,
    assignedToId: scope === 'mine' ? undefined : filters.assignedToId,
    deadlineFrom: filters.deadlineFrom,
    deadlineTo: filters.deadlineTo,
  }), [filters.assignedToId, filters.deadlineFrom, filters.deadlineTo, filters.overdue, filters.priority, filters.search, scope])
  const queryFilters = scope === 'mine' ? { ...filters, assignedToId: undefined } : filters
  const summary = useTaskSummary({ userId, scope, filters: summaryFilters, enabled: !filterError })
  const pending = useTasks({ userId, scope, status: 'PENDING', filters: queryFilters, enabled: !filterError })
  const working = useTasks({ userId, scope, status: 'WORKING', filters: queryFilters, enabled: !filterError })
  const done = useTasks({ userId, scope, status: 'DONE', filters: queryFilters, enabled: !filterError })
  const queries = { PENDING: pending, WORKING: working, DONE: done }
  const allTasks = columns.flatMap(({ status }) => flattenTaskPages(queries[status].data?.pages))
  const activeTask = allTasks.find((task) => task.id === activeTaskId)

  const refresh = async () => {
    if (!userId || isRefreshing) return
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all(userId) })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleScopeChange = (nextScope: TaskScope) => {
    setScope(nextScope)
    if (nextScope === 'mine') setFilters(({ assignedToId: _assignedToId, ...rest }) => rest)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = active.data.current?.task as Task | undefined
    if (task && canDragTask(auth.currentUser, task)) setActiveTaskId(task.id)
  }

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const task = active.data.current?.task as Task | undefined
    const nextStatus = over?.data.current?.status as TaskStatus | undefined
    setActiveTaskId(null)
    if (!task || !nextStatus || !canDropTask(auth.currentUser, task, nextStatus)) {
      if (task && nextStatus && nextStatus !== task.status) setFeedback({ message: 'That status change is not available for this task.', variant: 'error' })
      return
    }
    if (dragBusy.current) return
    dragBusy.current = true
    try {
      await updateStatus.mutateAsync({ id: task.id, input: { status: nextStatus } })
      setFeedback({ message: `Task moved to ${statusLabels[nextStatus]}.`, variant: 'success' })
    } catch (error) {
      setFeedback({ message: getTaskMutationErrorMessage(error), variant: 'error' })
    } finally {
      dragBusy.current = false
    }
  }

  const closeDetails = useCallback(() => setSelectedTaskId(null), [])
  const onActionSuccess = useCallback((message: string) => setFeedback({ message, variant: 'success' }), [])

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Work management"
        title="Taskboard"
        description="See current work across the office or focus on tasks assigned to you. Select a task to inspect its details."
        icon={ClipboardList}
        action={canCreateTask(auth.currentUser) ? <Button type="button" onClick={() => setCreateOpen(true)}>New task</Button> : <Badge variant="outline">Taskboard</Badge>}
      />
      <TaskActionFeedback message={feedback?.message ?? null} variant={feedback?.variant} onDismiss={() => setFeedback(null)} />
      <TaskBoardToolbar
        scope={scope}
        userId={userId}
        filters={filters}
        searchValue={searchDraft}
        onSearchChange={setSearchDraft}
        onScopeChange={handleScopeChange}
        onFiltersChange={setFilters}
        onClearFilters={() => { setSearchDraft(''); setFilters({}) }}
        onRefresh={() => void refresh()}
        isRefreshing={isRefreshing}
        filterError={filterError}
      />
      <TaskSummary summary={summary.data} isLoading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={(event) => { void handleDragEnd(event) }}
        onDragCancel={() => setActiveTaskId(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const task = active.data.current?.task as Task | undefined
              return task ? `Picked up ${task.title}. Use the arrow keys to move it between status columns.` : 'Picked up task.'
            },
            onDragOver: ({ over }) => {
              const status = over?.data.current?.status as TaskStatus | undefined
              return status ? `Task is over the ${statusLabels[status]} column.` : 'Task is not over a status column.'
            },
            onDragEnd: ({ over }) => {
              const status = over?.data.current?.status as TaskStatus | undefined
              return status ? `Task dropped in the ${statusLabels[status]} column.` : 'Task returned to its original column.'
            },
            onDragCancel: () => 'Task drag cancelled. Task returned to its original column.',
          },
        }}
      >
        <section aria-label={`${scope === 'all' ? 'All' : 'My'} tasks by status`} className="flex snap-x gap-4 overflow-x-auto pb-3 xl:grid xl:grid-cols-3 xl:overflow-visible">
          {columns.map(({ status, title, summaryKey }) => {
            const query = queries[status]
            const tasks = flattenTaskPages(query.data?.pages)
            return (
              <KanbanColumn
                key={status}
                status={status}
                title={title}
                count={summary.data?.[summaryKey]}
                tasks={tasks}
                isLoading={query.isLoading}
                isFetching={query.isFetching}
                error={query.error}
                onRetry={() => void query.refetch()}
                onSelectTask={setSelectedTaskId}
                hasNextPage={Boolean(query.hasNextPage)}
                isFetchingNextPage={query.isFetchingNextPage}
                onLoadMore={() => void query.fetchNextPage()}
                isDragActive={Boolean(activeTask)}
                isValidDropTarget={Boolean(activeTask && canDropTask(auth.currentUser, activeTask, status))}
                canDragTask={(task) => canDragTask(auth.currentUser, task)}
              />
            )
          })}
        </section>
        <DragOverlay>{activeTask ? <TaskDragPreview task={activeTask} /> : null}</DragOverlay>
      </DndContext>
      <TaskDetailsDialog taskId={selectedTaskId} onClose={closeDetails} onActionSuccess={onActionSuccess} />
      {createOpen && <CreateTaskDialog open onClose={() => setCreateOpen(false)} onSuccess={onActionSuccess} />}
    </div>
  )
}
