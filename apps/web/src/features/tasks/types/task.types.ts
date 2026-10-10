export const TASK_STATUSES = ['PENDING', 'WORKING', 'DONE'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type TaskScope = 'all' | 'mine'

export type TaskUser = {
  id: string
  fullName: string
  email: string
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'
  teamId: string | null
}

export type TaskTeam = {
  id: string
  name: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  teamId: string | null
  deadline: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  creator: TaskUser
  assignee: TaskUser
  team: TaskTeam | null
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedTasks = {
  data: Task[]
  pagination: PaginationMeta
}

export type TaskSummary = {
  total: number
  pending: number
  working: number
  done: number
  overdue: number
}

export type TaskListFilters = {
  priority?: TaskPriority
  search?: string
  overdue?: boolean
}

export type TaskSummaryFilters = Pick<TaskListFilters, 'priority' | 'search' | 'overdue'>

export type AssignableUser = {
  id: string
  fullName: string
  email: string
  teamId: string | null
}

export type PaginatedAssignableUsers = {
  data: AssignableUser[]
  pagination: PaginationMeta
}

export type CreateTaskInput = {
  title: string
  description?: string | null
  assignedToId: string
  priority?: TaskPriority
  deadline?: string | null
}

export type UpdateTaskInput = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'deadline'>>

export type UpdateTaskStatusInput = {
  status: TaskStatus
}

export type ReassignTaskInput = {
  assignedToId: string
}
