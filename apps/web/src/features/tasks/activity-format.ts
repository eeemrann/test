import { priorityLabels } from '@/features/tasks/task-format'
import type { TaskActivity, TaskActivityType, TaskPriority, TaskStatus } from '@/features/tasks/types/task.types'

const activityLabels: Record<TaskActivityType, string> = {
  CREATED: 'Task created',
  ASSIGNED: 'Task assigned',
  REASSIGNED: 'Task reassigned',
  STATUS_CHANGED: 'Task status changed',
  UPDATED: 'Task details updated',
}

const statusLabels: Record<TaskStatus, string> = { PENDING: 'Pending', WORKING: 'Working', DONE: 'Done' }
const validStatuses = new Set<TaskStatus>(['PENDING', 'WORKING', 'DONE'])
const validPriorities = new Set<TaskPriority>(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function status(value: unknown): TaskStatus | null {
  return typeof value === 'string' && validStatuses.has(value as TaskStatus) ? value as TaskStatus : null
}

function priority(value: unknown): string | null {
  return typeof value === 'string' && validPriorities.has(value as TaskPriority) ? priorityLabels[value as TaskPriority] : null
}

export function describeTaskActivity(activity: TaskActivity): { label: string; detail?: string } {
  const metadata = record(activity.metadata)
  if (activity.type === 'STATUS_CHANGED') {
    const previous = status(metadata?.previousStatus)
    const next = status(metadata?.newStatus)
    return { label: activityLabels[activity.type], detail: previous && next ? `Status changed from ${statusLabels[previous]} to ${statusLabels[next]}.` : undefined }
  }
  if (activity.type === 'REASSIGNED') return { label: activityLabels[activity.type], detail: 'The task assignee changed.' }
  if (activity.type === 'ASSIGNED') return { label: activityLabels[activity.type], detail: 'The task was assigned to an employee.' }
  if (activity.type === 'UPDATED') {
    const changes = record(metadata?.changes)
    const fields = changes ? Object.keys(changes).filter((field) => ['title', 'description', 'priority', 'deadline'].includes(field)) : []
    const readable = fields.map((field) => {
      if (field === 'title') return 'title'
      if (field === 'description') return 'description'
      if (field === 'deadline') return 'deadline'
      const change = record(changes?.[field])
      return change && (priority(change.previous) || priority(change.next)) ? 'priority' : field
    })
    return { label: activityLabels[activity.type], detail: readable.length ? `${[...new Set(readable)].join(', ')} updated.` : undefined }
  }
  return { label: activityLabels[activity.type] }
}

export function formatActivityTimestamp(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
