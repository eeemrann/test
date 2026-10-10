import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import {
  createTask,
  getAssignableUsers,
  getTaskById,
  getTaskActivities,
  getTaskSummary,
  getTasks,
  reassignTask,
  updateTask,
  updateTaskStatus,
} from '@/features/tasks/api/tasks-api'

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)
const mockedPost = vi.mocked(api.post)
const mockedPatch = vi.mocked(api.patch)

describe('tasks API integration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches a status-filtered all-task page with bounded pagination', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } })

    await getTasks({ scope: 'all', status: 'PENDING', page: 1 })

    expect(mockedGet).toHaveBeenCalledWith('/tasks', {
      params: { page: 1, limit: 20, status: 'PENDING' },
    })
  })

  it('uses the authenticated My Tasks endpoint without accepting a client user id', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } })

    await getTasks({ scope: 'mine', status: 'DONE', page: 2, filters: { priority: 'HIGH', overdue: false } })

    expect(mockedGet).toHaveBeenCalledWith('/tasks/my', {
      params: { page: 2, limit: 20, status: 'DONE', priority: 'HIGH', overdue: false },
    })
    expect(JSON.stringify(mockedGet.mock.calls[0])).not.toContain('assignedToId')
  })

  it('uses the summary scope and task detail endpoints', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { total: 4, pending: 1, working: 1, done: 2, overdue: 1 } })
      .mockResolvedValueOnce({ data: { id: 'task-1' } })

    await getTaskSummary('mine', { search: 'quarterly', overdue: true })
    await getTaskById('task-1')

    expect(mockedGet).toHaveBeenNthCalledWith(1, '/tasks/summary', {
      params: { scope: 'mine', search: 'quarterly', overdue: true },
    })
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/tasks/task-1')
  })

  it('serializes supported list filters and loads paginated activity history', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } })
      .mockResolvedValueOnce({ data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } })

    await getTasks({
      scope: 'all',
      status: 'WORKING',
      page: 1,
      filters: {
        search: 'report', priority: 'HIGH', assignedToId: 'employee-1',
        deadlineFrom: '2026-10-01T00:00:00.000Z', deadlineTo: '2026-10-31T23:59:59.999Z',
        overdue: false, sortBy: 'deadline', sortOrder: 'asc',
      },
    })
    await getTaskActivities('task-1', 2, 20)

    expect(mockedGet).toHaveBeenNthCalledWith(1, '/tasks', {
      params: {
        page: 1, limit: 20, status: 'WORKING', search: 'report', priority: 'HIGH', assignedToId: 'employee-1',
        deadlineFrom: '2026-10-01T00:00:00.000Z', deadlineTo: '2026-10-31T23:59:59.999Z', overdue: false,
        sortBy: 'deadline', sortOrder: 'asc',
      },
    })
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/tasks/task-1/activities', { params: { page: 2, limit: 20 } })
  })

  it('maps task mutations to the exact backend contracts without protected fields', async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: 'task-1' } })
    mockedPatch
      .mockResolvedValueOnce({ data: { id: 'task-1' } })
      .mockResolvedValueOnce({ data: { id: 'task-1' } })
      .mockResolvedValueOnce({ data: { id: 'task-1' } })

    await createTask({ title: 'Prepare report', assignedToId: 'employee-1', priority: 'HIGH', deadline: '2026-10-10T12:00:00.000Z' })
    await updateTask('task-1', { title: 'Updated report', description: null, priority: 'MEDIUM', deadline: null })
    await updateTaskStatus('task-1', { status: 'WORKING' })
    await reassignTask('task-1', { assignedToId: 'employee-2' })

    expect(mockedPost).toHaveBeenCalledWith('/tasks', {
      title: 'Prepare report', assignedToId: 'employee-1', priority: 'HIGH', deadline: '2026-10-10T12:00:00.000Z',
    })
    expect(mockedPatch).toHaveBeenNthCalledWith(1, '/tasks/task-1', { title: 'Updated report', description: null, priority: 'MEDIUM', deadline: null })
    expect(mockedPatch).toHaveBeenNthCalledWith(2, '/tasks/task-1/status', { status: 'WORKING' })
    expect(mockedPatch).toHaveBeenNthCalledWith(3, '/tasks/task-1/assign', { assignedToId: 'employee-2' })
    expect(JSON.stringify(mockedPost.mock.calls)).not.toContain('createdById')
    expect(JSON.stringify(mockedPost.mock.calls)).not.toContain('teamId')
    expect(JSON.stringify(mockedPost.mock.calls)).not.toContain('status')
  })

  it('loads only the public assignable-user directory with pagination and search', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } } })

    await getAssignableUsers({ page: 1, limit: 100, search: 'eng' })

    expect(mockedGet).toHaveBeenCalledWith('/users/assignable', {
      params: { page: 1, limit: 100, search: 'eng' },
    })
    expect(JSON.stringify(mockedGet.mock.calls)).not.toContain('password')
  })
})
