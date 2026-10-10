import { useState } from 'react'
import { DialogShell } from '@/components/ui/dialog-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { EmployeeSelector } from '@/features/tasks/components/employee-selector'
import { useCreateTask } from '@/features/tasks/hooks/use-create-task'
import { getTaskMutationErrorMessage } from '@/features/tasks/task-errors'
import { toApiDeadline } from '@/features/tasks/task-format'
import { TASK_PRIORITIES, type TaskPriority } from '@/features/tasks/types/task.types'

type CreateTaskDialogProps = {
  open: boolean
  onClose: () => void
  onSuccess: (message: string) => void
}

type CreateForm = {
  title: string
  description: string
  priority: TaskPriority
  assignedToId: string
  deadline: string
}

const initialForm: CreateForm = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  assignedToId: '',
  deadline: '',
}

export function CreateTaskDialog({ open, onClose, onSuccess }: CreateTaskDialogProps) {
  const auth = useAuth()
  const mutation = useCreateTask(auth.currentUser?.id)
  const [form, setForm] = useState<CreateForm>(initialForm)
  const [errors, setErrors] = useState<{ title?: string; assignedToId?: string; deadline?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const close = () => {
    setForm(initialForm)
    setErrors({})
    setSubmitError(null)
    onClose()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    const title = form.title.trim()
    if (!title) nextErrors.title = 'Title is required.'
    if (title.length > 240) nextErrors.title = 'Title must be 240 characters or fewer.'
    if (!form.assignedToId) nextErrors.assignedToId = 'Select an active employee.'
    if (form.deadline && !toApiDeadline(form.deadline)) nextErrors.deadline = 'Enter a valid deadline.'
    setErrors(nextErrors)
    setSubmitError(null)
    if (Object.keys(nextErrors).length > 0) return

    try {
      await mutation.mutateAsync({
        title,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        priority: form.priority,
        assignedToId: form.assignedToId,
        ...(form.deadline ? { deadline: toApiDeadline(form.deadline) } : {}),
      })
      setForm(initialForm)
      close()
      onSuccess('Task created successfully.')
    } catch (error) {
      setSubmitError(getTaskMutationErrorMessage(error))
    }
  }

  return (
    <DialogShell
      open={open}
      onClose={close}
      title="Create a new task"
      description="Assign work to an active employee. Status and ownership are managed by the server."
      className="max-w-2xl"
    >
      <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
        <div className="space-y-2">
          <label htmlFor="create-task-title" className="text-sm font-medium text-slate-800">Task title <span className="text-rose-600">*</span></label>
          <Input id="create-task-title" value={form.title} maxLength={240} onChange={(event) => setForm({ ...form, title: event.target.value })} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'create-task-title-error' : undefined} autoFocus />
          {errors.title && <p id="create-task-title-error" className="text-sm text-rose-700">{errors.title}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="create-task-description" className="text-sm font-medium text-slate-800">Description</label>
          <textarea id="create-task-description" value={form.description} maxLength={5000} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Add context for the assignee" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="create-task-priority" className="text-sm font-medium text-slate-800">Priority</label>
            <select id="create-task-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="create-task-deadline" className="text-sm font-medium text-slate-800">Deadline <span className="text-xs font-normal text-slate-500">(optional)</span></label>
            <Input id="create-task-deadline" type="datetime-local" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} aria-invalid={Boolean(errors.deadline)} aria-describedby={errors.deadline ? 'create-task-deadline-error' : undefined} />
            {errors.deadline && <p id="create-task-deadline-error" className="text-sm text-rose-700">{errors.deadline}</p>}
          </div>
        </div>
        <EmployeeSelector id="create-task-assignee" value={form.assignedToId} onChange={(assignedToId) => setForm({ ...form, assignedToId })} disabled={mutation.isPending} error={errors.assignedToId} />
        {submitError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{submitError}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create task'}</Button>
        </div>
      </form>
    </DialogShell>
  )
}
