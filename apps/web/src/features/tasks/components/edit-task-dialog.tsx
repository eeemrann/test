import { useState } from 'react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUpdateTask } from '@/features/tasks/hooks/use-update-task'
import { getTaskMutationErrorMessage } from '@/features/tasks/task-errors'
import { toApiDeadline, toDatetimeLocalValue } from '@/features/tasks/task-format'
import { TASK_PRIORITIES, type Task, type TaskPriority } from '@/features/tasks/types/task.types'

type EditTaskDialogProps = {
  task: Task | null
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
}

type EditForm = { title: string; description: string; priority: TaskPriority; deadline: string }

export function EditTaskDialog({ task, open, onClose, onSuccess }: EditTaskDialogProps) {
  const auth = useAuth()
  const mutation = useUpdateTask(auth.currentUser?.id)
  const [form, setForm] = useState<EditForm>(() => task ? { title: task.title, description: task.description ?? '', priority: task.priority, deadline: toDatetimeLocalValue(task.deadline) } : { title: '', description: '', priority: 'MEDIUM', deadline: '' })
  const [errors, setErrors] = useState<{ title?: string; deadline?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!task) return null

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    const title = form.title.trim()
    if (!title) nextErrors.title = 'Title is required.'
    if (title.length > 240) nextErrors.title = 'Title must be 240 characters or fewer.'
    if (form.deadline && !toApiDeadline(form.deadline)) nextErrors.deadline = 'Enter a valid deadline.'
    setErrors(nextErrors)
    setSubmitError(null)
    if (Object.keys(nextErrors).length > 0) return

    const input: Record<string, string | null> = {}
    if (title !== task.title) input.title = title
    const description = form.description.trim() ? form.description : null
    if (description !== task.description) input.description = description
    if (form.priority !== task.priority) input.priority = form.priority
    const deadline = form.deadline ? toApiDeadline(form.deadline) : null
    const originalDeadlineInput = toDatetimeLocalValue(task.deadline)
    if (form.deadline !== originalDeadlineInput) input.deadline = deadline

    if (Object.keys(input).length === 0) {
      setSubmitError('No changes to save.')
      return
    }

    try {
      await mutation.mutateAsync({ id: task.id, input })
      onClose()
      onSuccess('Task updated successfully.')
    } catch (error) {
      setSubmitError(getTaskMutationErrorMessage(error))
    }
  }

  return (
    <DialogShell open={open} onClose={onClose} title="Edit task" description="Update the task details. Assignment and status use separate workflows." className="max-w-2xl">
      <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
        <div className="space-y-2">
          <label htmlFor="edit-task-title" className="text-sm font-medium text-slate-800">Task title <span className="text-rose-600">*</span></label>
          <Input id="edit-task-title" value={form.title} maxLength={240} onChange={(event) => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'edit-task-title-error' : undefined} autoFocus />
          {errors.title && <p id="edit-task-title-error" className="text-sm text-rose-700">{errors.title}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="edit-task-description" className="text-sm font-medium text-slate-800">Description</label>
          <textarea id="edit-task-description" value={form.description} maxLength={5000} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="edit-task-priority" className="text-sm font-medium text-slate-800">Priority</label>
            <select id="edit-task-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-task-deadline" className="text-sm font-medium text-slate-800">Deadline <span className="text-xs font-normal text-slate-500">(optional)</span></label>
            <Input id="edit-task-deadline" type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} aria-invalid={Boolean(errors.deadline)} aria-describedby={errors.deadline ? 'edit-task-deadline-error' : undefined} />
            {errors.deadline && <p id="edit-task-deadline-error" className="text-sm text-rose-700">{errors.deadline}</p>}
          </div>
        </div>
        {submitError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{submitError}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </form>
    </DialogShell>
  )
}
