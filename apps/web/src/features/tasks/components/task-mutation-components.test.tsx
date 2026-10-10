import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { TaskStatusActions } from '@/features/tasks/components/task-status-actions'
import type { Task } from '@/features/tasks/types/task.types'

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: { id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', role: 'EMPLOYEE' as 'EMPLOYEE' | 'MANAGER' | 'ADMIN', teamId: 'team-1', isActive: true },
  },
  createMutation: { mutateAsync: vi.fn(), isPending: false },
  statusMutation: { mutateAsync: vi.fn(), isPending: false },
  assignable: {
    data: { pages: [{ data: [
      { id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', teamId: 'team-1' },
      { id: 'employee-2', fullName: 'Employee Two', email: 'employee2@office.local', teamId: null },
    ] }] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  },
}))

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/features/tasks/hooks/use-create-task', () => ({ useCreateTask: () => mocks.createMutation }))
vi.mock('@/features/tasks/hooks/use-update-task-status', () => ({ useUpdateTaskStatus: () => mocks.statusMutation }))
vi.mock('@/features/tasks/hooks/use-assignable-users', () => ({
  useAssignableUsers: () => mocks.assignable,
  flattenAssignableUsers: (pages: Array<{ data: Array<{ id: string }> }> | undefined) => pages?.flatMap((page) => page.data) ?? [],
}))

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1', title: 'Task', description: null, status: 'PENDING', priority: 'MEDIUM', teamId: 'team-1', deadline: null,
  completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  creator: { id: 'creator-1', fullName: 'Creator', email: 'creator@office.local', role: 'MANAGER', teamId: 'team-1' },
  assignee: { id: 'employee-1', fullName: 'Employee One', email: 'employee@office.local', role: 'EMPLOYEE', teamId: 'team-1' },
  team: { id: 'team-1', name: 'Engineering' }, ...overrides,
})

describe('task mutation components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createMutation.isPending = false
    mocks.statusMutation.isPending = false
    mocks.createMutation.mutateAsync.mockResolvedValue(makeTask())
    mocks.statusMutation.mutateAsync.mockResolvedValue(makeTask({ status: 'WORKING' }))
  })

  it('validates a required title and assignee before creating', async () => {
    const user = userEvent.setup()
    render(<CreateTaskDialog open onClose={vi.fn()} onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Select an active employee.')).toBeInTheDocument()
    expect(mocks.createMutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('shows active employees, supports selecting teamless users, and submits only allowed create fields', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    render(<CreateTaskDialog open onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Task title *'), 'Prepare onboarding')
    await user.click(screen.getByRole('option', { name: /Employee Two/ }))
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(mocks.createMutation.mutateAsync).toHaveBeenCalledWith({
      title: 'Prepare onboarding',
      priority: 'MEDIUM',
      assignedToId: 'employee-2',
    })
    expect(mocks.createMutation.mutateAsync.mock.calls[0][0]).not.toHaveProperty('status')
    expect(mocks.createMutation.mutateAsync.mock.calls[0][0]).not.toHaveProperty('createdById')
    expect(mocks.createMutation.mutateAsync.mock.calls[0][0]).not.toHaveProperty('teamId')
    expect(onClose).toHaveBeenCalledOnce()
    expect(onSuccess).toHaveBeenCalledWith('Task created successfully.')
  })

  it('preserves form values after a failed create', async () => {
    const user = userEvent.setup()
    mocks.createMutation.mutateAsync.mockRejectedValueOnce(new Error('request failed'))
    render(<CreateTaskDialog open onClose={vi.fn()} onSuccess={vi.fn()} />)

    const title = screen.getByLabelText('Task title *')
    await user.type(title, 'Keep this value')
    await user.click(screen.getByRole('option', { name: /Employee One/ }))
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(title).toHaveValue('Keep this value')
    expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred')
  })

  it('gives an assigned employee only the next allowed status action', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<TaskStatusActions task={makeTask({ assignee: { ...makeTask().assignee, id: 'employee-1' } })} onSuccess={onSuccess} />)

    await user.click(screen.getByRole('button', { name: 'Start working' }))

    expect(mocks.statusMutation.mutateAsync).toHaveBeenCalledWith({ id: 'task-1', input: { status: 'WORKING' } })
    expect(onSuccess).toHaveBeenCalledWith('Task marked working.')
  })

  it('does not render employee status controls for managers', () => {
    mocks.auth.currentUser = { ...mocks.auth.currentUser, role: 'MANAGER' }
    render(<TaskStatusActions task={makeTask()} onSuccess={vi.fn()} />)

    expect(screen.queryByText('Status actions')).not.toBeInTheDocument()
  })

  it('renders all admin correction statuses', () => {
    mocks.auth.currentUser = { ...mocks.auth.currentUser, role: 'ADMIN' }
    render(<TaskStatusActions task={makeTask({ status: 'DONE' })} onSuccess={vi.fn()} />)

    const select = screen.getByLabelText('New task status')
    expect(within(select).getByRole('option', { name: 'Pending' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Working' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Done' })).toBeInTheDocument()
  })
})
