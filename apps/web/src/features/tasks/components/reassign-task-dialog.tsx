import { useState } from 'react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { EmployeeSelector } from '@/features/tasks/components/employee-selector'
import { useReassignTask } from '@/features/tasks/hooks/use-reassign-task'
import { getTaskMutationErrorMessage } from '@/features/tasks/task-errors'
import type { Task } from '@/features/tasks/types/task.types'

type ReassignTaskDialogProps = {
  task: Task | null
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
}

export function ReassignTaskDialog({ task, open, onClose, onSuccess }: ReassignTaskDialogProps) {
  const auth = useAuth()
  const mutation = useReassignTask(auth.currentUser?.id)
  const [assigneeId, setAssigneeId] = useState(task?.assignee.id ?? '')
  const [error, setError] = useState<string | null>(null)

  if (!open || !task || !auth.currentUser) return null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assigneeId || assigneeId === task.assignee.id) {
      setError('Choose a different active employee.')
      return
    }
    setError(null)
    try {
      await mutation.mutateAsync({ id: task.id, input: { assignedToId: assigneeId } })
      onClose()
      onSuccess('Task reassigned successfully.')
    } catch (mutationError) {
      setError(getTaskMutationErrorMessage(mutationError))
    }
  }

  return (
    <DialogShell open={open} onClose={onClose} title="Reassign task" description="Eligible active employees and administrators are shown. The backend rechecks team permissions before saving.">
      <form className="space-y-5" onSubmit={(event) => void submit(event)}>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Current assignee: <span className="font-medium text-slate-950">{task.assignee.fullName}</span><br /><span className="text-xs text-slate-500">{task.assignee.email} · {task.team?.name ?? 'No team'}</span></div>
        <EmployeeSelector id="reassign-task-assignee" value={assigneeId} onChange={setAssigneeId} disabled={mutation.isPending} error={error ?? undefined} purpose="reassign" />
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Reassigning…' : 'Confirm reassignment'}</Button>
        </div>
      </form>
    </DialogShell>
  )
}
