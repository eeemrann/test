import { describe, expect, it } from 'vitest'
import { canCreateTask, canEditTask, canReassignTask, getEmployeeStatusAction } from '@/features/tasks/lib/task-permissions'
import type { AuthUser } from '@/features/auth/types/auth.types'
import type { Task } from '@/features/tasks/types/task.types'

const user = (role: AuthUser['role'], id = 'user-1', teamId: string | null = 'team-1'): AuthUser => ({
  id, fullName: 'Test User', email: 'test@office.local', role, teamId, isActive: true,
})

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1', title: 'Task', description: null, status: 'PENDING', priority: 'MEDIUM', teamId: 'team-1',
  deadline: null, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  creator: { id: 'creator-1', fullName: 'Creator', email: 'creator@office.local', role: 'EMPLOYEE', teamId: 'team-1' },
  assignee: { id: 'employee-1', fullName: 'Employee', email: 'employee@office.local', role: 'EMPLOYEE', teamId: 'team-1' },
  team: { id: 'team-1', name: 'Engineering' }, ...overrides,
})

describe('task permissions', () => {
  it('allows all active roles to create but never inactive users', () => {
    expect(['EMPLOYEE', 'MANAGER', 'ADMIN'].every((role) => canCreateTask(user(role as AuthUser['role'])))).toBe(true)
    expect(canCreateTask({ ...user('EMPLOYEE'), isActive: false })).toBe(false)
  })

  it('allows pending creators to edit and limits completed edits to admins', () => {
    const ownPending = task({ creator: { ...task().creator, id: 'user-1' } })
    expect(canEditTask(user('EMPLOYEE'), ownPending)).toBe(true)
    expect(canEditTask(user('MANAGER'), ownPending)).toBe(true)
    expect(canEditTask(user('EMPLOYEE', 'other'), ownPending)).toBe(false)
    expect(canEditTask(user('ADMIN', 'admin'), task({ status: 'DONE' }))).toBe(true)
    expect(canEditTask(user('MANAGER'), task({ status: 'DONE' }))).toBe(false)
  })

  it('only gives employees their allowed status action and gives admins correction access', () => {
    expect(getEmployeeStatusAction(user('EMPLOYEE', 'employee-1'), task())).toBe('WORKING')
    expect(getEmployeeStatusAction(user('EMPLOYEE', 'employee-1'), task({ status: 'WORKING' }))).toBe('DONE')
    expect(getEmployeeStatusAction(user('EMPLOYEE', 'other'), task())).toBeNull()
    expect(getEmployeeStatusAction(user('EMPLOYEE', 'employee-1'), task({ status: 'DONE' }))).toBeNull()
    expect(getEmployeeStatusAction(user('MANAGER'), task())).toBeNull()
  })

  it('restricts managers to same-team tasks while admins can reassign across teams', () => {
    expect(canReassignTask(user('MANAGER'), task())).toBe(true)
    expect(canReassignTask(user('MANAGER'), task({ teamId: 'team-2' }))).toBe(false)
    expect(canReassignTask(user('MANAGER', 'manager-1', null), task())).toBe(false)
    expect(canReassignTask(user('ADMIN', 'admin', null), task({ teamId: null }))).toBe(true)
  })
})
