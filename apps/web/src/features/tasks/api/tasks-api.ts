import { api } from '@/lib/api'
import type {
  PaginatedTasks,
  PaginatedAssignableUsers,
  CreateTaskInput,
  ReassignTaskInput,
  Task,
  TaskListFilters,
  TaskScope,
  TaskStatus,
  TaskSummary,
  TaskSummaryFilters,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from '@/features/tasks/types/task.types'

const TASK_PAGE_SIZE = 20

function getTaskListPath(scope: TaskScope): string {
  return scope === 'mine' ? '/tasks/my' : '/tasks'
}

export async function getTasks({
  scope,
  status,
  page,
  filters = {},
}: {
  scope: TaskScope
  status: TaskStatus
  page: number
  filters?: TaskListFilters
}): Promise<PaginatedTasks> {
  const response = await api.get<PaginatedTasks>(getTaskListPath(scope), {
    params: {
      page,
      limit: TASK_PAGE_SIZE,
      status,
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.overdue === undefined ? {} : { overdue: filters.overdue }),
    },
  })

  return response.data
}

export async function getTaskSummary(
  scope: TaskScope,
  filters: TaskSummaryFilters = {},
): Promise<TaskSummary> {
  const response = await api.get<TaskSummary>('/tasks/summary', {
    params: {
      scope,
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.overdue === undefined ? {} : { overdue: filters.overdue }),
    },
  })

  return response.data
}

export async function getTaskById(id: string): Promise<Task> {
  const response = await api.get<Task>(`/tasks/${id}`)
  return response.data
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const response = await api.post<Task>('/tasks', input)
  return response.data
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${id}`, input)
  return response.data
}

export async function updateTaskStatus(id: string, input: UpdateTaskStatusInput): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${id}/status`, input)
  return response.data
}

export async function reassignTask(id: string, input: ReassignTaskInput): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${id}/assign`, input)
  return response.data
}

export async function getAssignableUsers({
  page = 1,
  limit = 100,
  search,
}: {
  page?: number
  limit?: number
  search?: string
} = {}): Promise<PaginatedAssignableUsers> {
  const response = await api.get<PaginatedAssignableUsers>('/users/assignable', {
    params: {
      page,
      limit,
      ...(search ? { search } : {}),
    },
  })
  return response.data
}

export { TASK_PAGE_SIZE, getTaskListPath }
