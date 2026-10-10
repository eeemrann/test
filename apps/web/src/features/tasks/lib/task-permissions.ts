import type { AuthUser } from '@/features/auth/types/auth.types'
import type { Task, TaskStatus } from '@/features/tasks/types/task.types'

export function canCreateTask(user: AuthUser | null): boolean {
  return Boolean(user?.isActive)
}

export function canEditTask(user: AuthUser | null, task: Task): boolean {
  if (!user?.isActive) return false
  if (user.role === 'ADMIN') return true
  return (user.role === 'EMPLOYEE' || user.role === 'MANAGER') &&
    task.creator.id === user.id && task.status === 'PENDING'
}

export function canUpdateTaskStatus(user: AuthUser | null, task: Task): boolean {
  if (!user?.isActive) return false
  return user.role === 'ADMIN' || (user.role === 'EMPLOYEE' && task.assignee.id === user.id)
}

export function canDragTask(user: AuthUser | null, task: Task): boolean {
  if (!user?.isActive) return false
  if (user.role === 'ADMIN') return true
  return user.role === 'EMPLOYEE' && task.assignee.id === user.id && task.status !== 'DONE'
}

export function canDropTask(user: AuthUser | null, task: Task, nextStatus: TaskStatus): boolean {
  if (!user?.isActive || nextStatus === task.status) return false
  if (user.role === 'ADMIN') return true
  return getEmployeeStatusAction(user, task) === nextStatus
}

export function getEmployeeStatusAction(user: AuthUser | null, task: Task): TaskStatus | null {
  if (!user?.isActive || user.role !== 'EMPLOYEE' || task.assignee.id !== user.id) return null
  if (task.status === 'PENDING') return 'WORKING'
  if (task.status === 'WORKING') return 'DONE'
  return null
}

export function canReassignTask(user: AuthUser | null, task: Task): boolean {
  if (!user?.isActive || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) return false
  if (user.role === 'ADMIN') return true
  return Boolean(
    user.teamId &&
    task.teamId === user.teamId &&
    task.assignee.teamId === user.teamId,
  )
}
