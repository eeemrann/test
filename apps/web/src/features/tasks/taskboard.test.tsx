import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskBoard } from '@/features/tasks/components/task-board'
import type { Task, TaskStatus } from '@/features/tasks/types/task.types'

const mocks = vi.hoisted(() => ({
  useTasks: vi.fn(),
  useTaskSummary: vi.fn(),
  useTaskDetails: vi.fn(),
  useTaskActivities: vi.fn(),
  useAssignableUsers: vi.fn(),
  auth: {
    currentUser: { id: 'user-1', fullName: 'Ada Lovelace', email: 'ada@office.local', role: 'MANAGER' as const, teamId: 'team-1', isActive: true },
  },
}))

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/features/tasks/hooks/use-tasks', async () => {
  const actual = await vi.importActual<typeof import('@/features/tasks/hooks/use-tasks')>('@/features/tasks/hooks/use-tasks')
  return { ...actual, useTasks: mocks.useTasks }
})
vi.mock('@/features/tasks/hooks/use-task-summary', () => ({ useTaskSummary: mocks.useTaskSummary }))
vi.mock('@/features/tasks/hooks/use-task-details', () => ({ useTaskDetails: mocks.useTaskDetails }))
vi.mock('@/features/tasks/hooks/use-task-activities', () => ({
  useTaskActivities: mocks.useTaskActivities,
  flattenActivityPages: (pages: Array<{ data: unknown[] }> | undefined) => pages?.flatMap((page) => page.data) ?? [],
}))
vi.mock('@/features/tasks/hooks/use-assignable-users', () => ({
  useAssignableUsers: mocks.useAssignableUsers,
  flattenAssignableUsers: (pages: Array<{ data: unknown[] }> | undefined) => pages?.flatMap((page) => page.data) ?? [],
}))

const baseTask: Task = {
  id: 'task-1',
  title: 'Prepare quarterly report',
  description: 'Compile the department figures.',
  status: 'PENDING',
  priority: 'HIGH',
  teamId: 'team-1',
  deadline: '2020-01-02T00:00:00.000Z',
  completedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  creator: { id: 'creator-1', fullName: 'Manager User', email: 'manager@office.local', role: 'MANAGER', teamId: 'team-1' },
  assignee: { id: 'user-1', fullName: 'Ada Lovelace', email: 'ada@office.local', role: 'MANAGER', teamId: 'team-1' },
  team: { id: 'team-1', name: 'Engineering' },
}

function makeColumn(status: TaskStatus, tasks: Task[] = []) {
  return {
    data: { pages: [{ data: tasks.map((task) => ({ ...task, status })), pagination: { page: 1, limit: 20, total: tasks.length, totalPages: 1 } }] },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }
}

function configureBoard({
  summary = { total: 1, pending: 1, working: 0, done: 0, overdue: 1 },
  columns = { PENDING: makeColumn('PENDING', [baseTask]), WORKING: makeColumn('WORKING'), DONE: makeColumn('DONE') },
  summaryError = null,
}: {
  summary?: { total: number; pending: number; working: number; done: number; overdue: number }
  columns?: Record<TaskStatus, ReturnType<typeof makeColumn>>
  summaryError?: unknown
} = {}) {
  mocks.useTaskSummary.mockReturnValue({ data: summary, isLoading: false, error: summaryError, refetch: vi.fn() })
  mocks.useTasks.mockImplementation(({ status }: { status: TaskStatus }) => columns[status])
  mocks.useTaskDetails.mockReturnValue({ data: baseTask, isLoading: false, error: null })
  mocks.useTaskActivities.mockReturnValue({ data: { pages: [{ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }] }, isLoading: false, error: null, refetch: vi.fn(), hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() })
  mocks.useAssignableUsers.mockReturnValue({ data: { pages: [{ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }] }, isLoading: false })
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><TaskBoard /></QueryClientProvider>)
}

describe('TaskBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureBoard()
  })

  it('renders all three status columns and server summary counts', () => {
    renderBoard()

    expect(screen.getByRole('heading', { name: 'Taskboard' })).toBeInTheDocument()
    expect(screen.getByText('Prepare quarterly report')).toBeInTheDocument()
    expect(screen.getByText('Pending', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()
    expect(screen.getByText('Working', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()
    expect(screen.getByText('Done', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()
    expect(screen.getByText('Total tasks')).toBeInTheDocument()
    expect(screen.getAllByText('1', { selector: 'p' })).toHaveLength(3)
    expect(screen.getByText('High', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
    expect(screen.getByText('Overdue', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/Overdue ·/)).toBeInTheDocument()
  })

  it('renders useful empty states without creating task data', () => {
    configureBoard({ summary: { total: 0, pending: 0, working: 0, done: 0, overdue: 0 }, columns: { PENDING: makeColumn('PENDING'), WORKING: makeColumn('WORKING'), DONE: makeColumn('DONE') } })
    renderBoard()

    expect(screen.getByText('No pending tasks')).toBeInTheDocument()
    expect(screen.getByText('No tasks in progress')).toBeInTheDocument()
    expect(screen.getByText('No completed tasks yet')).toBeInTheDocument()
    expect(screen.queryByText('Prepare quarterly report')).not.toBeInTheDocument()
  })

  it('shows loading and independent column errors with retry actions', async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    const errorColumn = { ...makeColumn('WORKING'), error: new Error('backend unavailable'), refetch }
    mocks.useTasks.mockImplementation(({ status }: { status: TaskStatus }) => status === 'WORKING' ? errorColumn : { ...makeColumn(status), isLoading: true })
    renderBoard()

    expect(screen.getByLabelText('Loading pending tasks')).toBeInTheDocument()
    expect(screen.getByText('Could not load working tasks')).toBeInTheDocument()
    await user.click(within(screen.getByText('Could not load working tasks').parentElement!.parentElement!).getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('switches between All Tasks and My Tasks using the selected scope', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(screen.getByRole('button', { name: 'My Tasks' }))

    expect(mocks.useTasks).toHaveBeenCalledWith(expect.objectContaining({ scope: 'mine' }))
    expect(mocks.useTaskSummary).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'mine' }))
  })

  it('loads another page per column and opens read-only task details', async () => {
    const user = userEvent.setup()
    const fetchNextPage = vi.fn()
    const pending = { ...makeColumn('PENDING', [baseTask]), hasNextPage: true, fetchNextPage }
    configureBoard({ columns: { PENDING: pending, WORKING: makeColumn('WORKING'), DONE: makeColumn('DONE') } })
    renderBoard()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(fetchNextPage).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Open task Prepare quarterly report' }))

    const dialog = screen.getByRole('dialog', { name: 'Prepare quarterly report' })
    expect(within(dialog).getByText('Compile the department figures.')).toBeInTheDocument()
    expect(within(dialog).getByText('Manager User · Manager')).toBeInTheDocument()
    expect(within(dialog).getByText('Engineering')).toBeInTheDocument()
  })

  it('refreshes current task queries without changing the selected scope', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(mocks.useTasks).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'All Tasks' })).toHaveAttribute('aria-pressed', 'true')
  })
})
