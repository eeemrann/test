import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUpdateTaskStatus } from '@/features/tasks/hooks/use-update-task-status'
import { getTaskMutationErrorMessage } from '@/features/tasks/task-errors'
import { getEmployeeStatusAction } from '@/features/tasks/lib/task-permissions'
import type { Task, TaskStatus } from '@/features/tasks/types/task.types'

type TaskStatusActionsProps = {
  task: Task
  onSuccess: (message: string) => void
}

const statusLabel: Record<TaskStatus, string> = { PENDING: 'Pending', WORKING: 'Working', DONE: 'Done' }

export function TaskStatusActions({ task, onSuccess }: TaskStatusActionsProps) {
  const auth = useAuth()
  const mutation = useUpdateTaskStatus(auth.currentUser?.id)
  const [adminStatus, setAdminStatus] = useState<TaskStatus>(task.status)
  const [error, setError] = useState<string | null>(null)
  const employeeNextStatus = getEmployeeStatusAction(auth.currentUser, task)
  const isAdmin = auth.currentUser?.role === 'ADMIN' && auth.currentUser.isActive

  if (!employeeNextStatus && !isAdmin) return null

  const update = async (status: TaskStatus) => {
    if (status === task.status || mutation.isPending) return
    setError(null)
    try {
      await mutation.mutateAsync({ id: task.id, input: { status } })
      setAdminStatus(status)
      onSuccess(`Task marked ${statusLabel[status].toLowerCase()}.`)
    } catch (mutationError) {
      setError(getTaskMutationErrorMessage(mutationError))
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">Status actions</h3>
        <p className="mt-1 text-xs text-slate-600">Changes are confirmed by the backend before the board refreshes.</p>
      </div>
      {isAdmin ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="admin-task-status" className="sr-only">New task status</label>
          <select id="admin-task-status" value={adminStatus} onChange={(event) => setAdminStatus(event.target.value as TaskStatus)} disabled={mutation.isPending} className="h-9 flex-1 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            {(['PENDING', 'WORKING', 'DONE'] as const).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
          </select>
          <Button type="button" onClick={() => void update(adminStatus)} disabled={mutation.isPending || adminStatus === task.status}>{mutation.isPending ? 'Updating…' : 'Update status'}</Button>
        </div>
      ) : employeeNextStatus ? (
        <Button type="button" onClick={() => void update(employeeNextStatus)} disabled={mutation.isPending}>{mutation.isPending ? 'Updating…' : employeeNextStatus === 'WORKING' ? 'Start working' : 'Mark as done'}</Button>
      ) : null
      }
      {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
    </div>
  )
}
