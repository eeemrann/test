import { ClipboardList } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { PageHeader } from '@/layouts/components/page-header'
import { taskQueryKeys, flattenTaskPages, useTasks } from '@/features/tasks/hooks/use-tasks'
import { useTaskSummary } from '@/features/tasks/hooks/use-task-summary'
import { KanbanColumn } from '@/features/tasks/components/kanban-column'
import { TaskBoardToolbar } from '@/features/tasks/components/task-board-toolbar'
import { TaskDetailsDialog } from '@/features/tasks/components/task-details-dialog'
import { TaskSummary } from '@/features/tasks/components/task-summary'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { TaskActionFeedback } from '@/features/tasks/components/task-action-feedback'
import { canCreateTask } from '@/features/tasks/lib/task-permissions'
import type { TaskScope, TaskStatus } from '@/features/tasks/types/task.types'
import { queryClient } from '@/lib/query-client'

const columns: readonly { status: TaskStatus; title: string; summaryKey: 'pending' | 'working' | 'done' }[] = [
  { status: 'PENDING', title: 'Pending', summaryKey: 'pending' },
  { status: 'WORKING', title: 'Working', summaryKey: 'working' },
  { status: 'DONE', title: 'Done', summaryKey: 'done' },
]

export function TaskBoard() {
  const auth = useAuth()
  const [scope, setScope] = useState<TaskScope>('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const userId = auth.currentUser?.id
  const filters = {}

  const summary = useTaskSummary({ userId, scope, filters })
  const pending = useTasks({ userId, scope, status: 'PENDING', filters })
  const working = useTasks({ userId, scope, status: 'WORKING', filters })
  const done = useTasks({ userId, scope, status: 'DONE', filters })
  const queries = { PENDING: pending, WORKING: working, DONE: done }

  const refresh = async () => {
    if (!userId || isRefreshing) return
    setIsRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: taskQueryKeys.all(userId) })
    } finally {
      setIsRefreshing(false)
    }
  }

  const closeDetails = useCallback(() => setSelectedTaskId(null), [])

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Work management"
        title="Taskboard"
        description="See current work across the office or focus on tasks assigned to you. Select a task to inspect its details."
        icon={ClipboardList}
        action={canCreateTask(auth.currentUser) ? <Button type="button" onClick={() => setCreateOpen(true)}>New task</Button> : <Badge variant="outline">Taskboard</Badge>}
      />
      <TaskActionFeedback message={feedback} onDismiss={() => setFeedback(null)} />
      <TaskBoardToolbar scope={scope} onScopeChange={setScope} onRefresh={() => void refresh()} isRefreshing={isRefreshing} />
      <TaskSummary summary={summary.data} isLoading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} />
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
            />
          )
        })}
      </section>
      <TaskDetailsDialog taskId={selectedTaskId} onClose={closeDetails} onActionSuccess={setFeedback} />
      {createOpen && <CreateTaskDialog open onClose={() => setCreateOpen(false)} onSuccess={setFeedback} />}
    </div>
  )
}
