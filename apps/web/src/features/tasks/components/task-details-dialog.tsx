import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, CircleUserRound, Clock3, Edit3, UserRound, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuthUser } from '@/features/auth/types/auth.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getRoleLabel } from '@/features/auth/role-labels'
import { getApiErrorMessage } from '@/lib/api'
import { formatTaskDate, priorityClasses, priorityLabels } from '@/features/tasks/task-format'
import { useTaskDetails } from '@/features/tasks/hooks/use-task-details'
import { canEditTask, canReassignTask, getEmployeeStatusAction } from '@/features/tasks/lib/task-permissions'
import { EditTaskDialog } from '@/features/tasks/components/edit-task-dialog'
import { ReassignTaskDialog } from '@/features/tasks/components/reassign-task-dialog'
import { TaskStatusActions } from '@/features/tasks/components/task-status-actions'
import type { Task } from '@/features/tasks/types/task.types'

type TaskDetailsDialogProps = {
  taskId: string | null
  onClose: () => void
  onActionSuccess?: (message: string) => void
}

export function TaskDetailsDialog({ taskId, onClose, onActionSuccess }: TaskDetailsDialogProps) {
  const auth = useAuth()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const open = Boolean(taskId)
  const details = useTaskDetails({ userId: auth.currentUser?.id, taskId, enabled: open })
  const [editOpen, setEditOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  const task = details.data

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label="Close task details" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative z-10 max-h-[min(45rem,calc(100svh-2rem))] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <CardHeader className="sticky top-0 z-10 flex-row items-start justify-between gap-4 border-b border-slate-100 bg-white/95 pb-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Task details</p>
            <CardTitle id="task-details-title" className="mt-1 truncate text-xl">{task?.title ?? 'Task information'}</CardTitle>
          </div>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close task details"><X aria-hidden="true" /></Button>
        </CardHeader>
        <CardContent className="space-y-6 p-5 sm:p-6">
          {details.isLoading ? (
            <div className="space-y-4" aria-label="Loading task details">
              <Skeleton className="h-20 w-full" />
              <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            </div>
          ) : details.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" /><div><p className="font-medium text-rose-900">Task details are unavailable</p><p className="mt-1 text-sm text-rose-800">{getApiErrorMessage(details.error)}</p></div></div>
            </div>
          ) : task ? (
            <>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description || 'No description provided.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Status" value={task.status === 'DONE' ? 'Done' : task.status === 'WORKING' ? 'Working' : 'Pending'} icon={CheckCircle2} />
                <Detail label="Priority" value={priorityLabels[task.priority]} icon={CircleUserRound} valueClassName={priorityClasses[task.priority]} />
                <Detail label="Assignee" value={`${task.assignee.fullName} · ${getRoleLabel(task.assignee.role)}`} icon={CircleUserRound} />
                <Detail label="Creator" value={`${task.creator.fullName} · ${getRoleLabel(task.creator.role)}`} icon={CircleUserRound} />
                <Detail label="Team" value={task.team?.name ?? 'Not assigned'} icon={CircleUserRound} />
                <Detail label="Deadline" value={formatTaskDate(task.deadline) ?? 'No deadline'} icon={CalendarDays} />
                <Detail label="Created" value={formatTaskDate(task.createdAt) ?? 'Unavailable'} icon={Clock3} />
                <Detail label="Updated" value={formatTaskDate(task.updatedAt) ?? 'Unavailable'} icon={Clock3} />
                {task.completedAt && <Detail label="Completed" value={formatTaskDate(task.completedAt) ?? 'Unavailable'} icon={CheckCircle2} />}
              </div>
              <section className="space-y-3 border-t border-slate-100 pt-5" aria-label="Task actions">
                <div className="flex items-center gap-2"><Edit3 className="size-4 text-blue-700" aria-hidden="true" /><h3 className="text-sm font-semibold text-slate-950">Actions</h3></div>
                <div className="flex flex-wrap gap-2">
                  {canEditTask(auth.currentUser, task) && <Button type="button" variant="outline" onClick={() => setEditOpen(true)}><Edit3 aria-hidden="true" />Edit</Button>}
                  {canReassignTask(auth.currentUser, task) && <Button type="button" variant="outline" onClick={() => setReassignOpen(true)}><UserRound aria-hidden="true" />Reassign</Button>}
                </div>
                <TaskStatusActions key={`${task.id}-${task.status}`} task={task} onSuccess={(message) => onActionSuccess?.(message)} />
                {!canEditTask(auth.currentUser, task) && !canReassignTask(auth.currentUser, task) && !canStatusAction(auth.currentUser, task) && <p className="text-sm text-slate-500">No actions are available for your role on this task.</p>}
              </section>
              {editOpen && <EditTaskDialog key={`edit-${task.id}`} task={task} open onClose={() => setEditOpen(false)} onSuccess={(message) => onActionSuccess?.(message)} />}
              {reassignOpen && <ReassignTaskDialog key={`reassign-${task.id}`} task={task} open onClose={() => setReassignOpen(false)} onSuccess={(message) => onActionSuccess?.(message)} />}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function canStatusAction(user: AuthUser | null, task: Task): boolean {
  return user?.isActive === true && (user.role === 'ADMIN' || Boolean(getEmployeeStatusAction(user, task)))
}

function Detail({ label, value, icon: Icon, valueClassName }: { label: string; value: string; icon: LucideIcon; valueClassName?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><Icon className="size-3.5" aria-hidden="true" />{label}</p>
      <p className={`mt-2 text-sm font-medium text-slate-900 ${valueClassName ?? ''}`}>{value}</p>
    </div>
  )
}
