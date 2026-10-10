import type { Task, TaskPriority } from '@/features/tasks/types/task.types'

export const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const priorityClasses: Record<TaskPriority, string> = {
  LOW: 'border-slate-200 bg-slate-50 text-slate-600',
  MEDIUM: 'border-blue-200 bg-blue-50 text-blue-700',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
  URGENT: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function formatTaskDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function isTaskOverdue(task: Pick<Task, 'deadline' | 'status'>, now = new Date()): boolean {
  if (!task.deadline || task.status === 'DONE') return false
  const deadline = new Date(task.deadline)
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime()
}

export function toDatetimeLocalValue(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toApiDeadline(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
