import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { NotificationsPage } from '@/pages/notifications-page'

const notification = {
  id: 'notification-1',
  type: 'TASK_ASSIGNED' as const,
  title: 'New task assigned',
  message: 'Prepare the quarterly report.',
  taskId: 'task-1',
  readAt: null,
  createdAt: '2026-10-11T11:55:00.000Z',
}

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: true, currentUser: { id: 'user-1' } },
  unreadCount: vi.fn(),
  notifications: vi.fn(),
  markRead: vi.fn(),
  markAll: vi.fn(),
}))

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => mocks.auth }))
vi.mock('@/features/notifications/hooks/use-unread-count', () => ({ useUnreadCount: mocks.unreadCount }))
vi.mock('@/features/notifications/hooks/use-notifications', async () => {
  const actual = await vi.importActual<typeof import('@/features/notifications/hooks/use-notifications')>('@/features/notifications/hooks/use-notifications')
  return { ...actual, useNotifications: mocks.notifications }
})
vi.mock('@/features/notifications/hooks/use-mark-notification-read', () => ({ useMarkNotificationRead: () => ({ mutate: mocks.markRead, isPending: false, error: null }) }))
vi.mock('@/features/notifications/hooks/use-mark-all-read', () => ({ useMarkAllRead: () => ({ mutate: mocks.markAll, isPending: false, error: null }) }))
vi.mock('@/features/notifications/components/notification-popover', () => ({ NotificationPopover: () => <div>Recent notifications panel</div> }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><NotificationsPage /></MemoryRouter></QueryClientProvider>)
}

describe('notification UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.unreadCount.mockReturnValue({ data: { count: 3 }, isLoading: false, isError: false })
    mocks.notifications.mockReturnValue({
      data: { pages: [{ data: [notification], pagination: { page: 1, limit: 20, total: 1, totalPages: 2 } }] },
      isLoading: false,
      error: null,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })
  })

  it('shows the real unread count and opens the recent-notifications view', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)

    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Notifications, 3 unread' }))
    expect(screen.getByText('Recent notifications panel')).toBeInTheDocument()
  })

  it('renders the full inbox, changes filters, and calls read mutations', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('New task assigned')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark read' }))
    expect(mocks.markRead).toHaveBeenCalledWith('notification-1')
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    expect(mocks.markAll).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('tab', { name: 'Unread' }))
    expect(mocks.notifications).toHaveBeenLastCalledWith(expect.objectContaining({ unreadOnly: true }))
  })

  it('exposes load-more pagination without inventing notification data', async () => {
    const user = userEvent.setup()
    const fetchNextPage = vi.fn()
    mocks.notifications.mockReturnValue({
      data: { pages: [{ data: [notification], pagination: { page: 1, limit: 20, total: 2, totalPages: 2 } }] },
      isLoading: false, error: null, hasNextPage: true, isFetchingNextPage: false, fetchNextPage, refetch: vi.fn(),
    })
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Load more notifications' }))
    expect(fetchNextPage).toHaveBeenCalledOnce()
    expect(screen.queryByText('Notification generated for testing')).not.toBeInTheDocument()
  })
})
