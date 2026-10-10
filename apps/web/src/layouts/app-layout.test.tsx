import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLayout } from '@/layouts/app-layout'
import { ProfilePage } from '@/pages/profile-page'

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    currentUser: {
      id: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@office.local',
      role: 'MANAGER' as const,
      teamId: 'team-engineering',
      isActive: true,
    },
    logout: vi.fn(async () => ({ serverRevoked: true })),
  },
}))

vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => mocks.auth,
}))
vi.mock('@/features/notifications/components/notification-bell', () => ({
  NotificationBell: () => <button type="button" aria-label="Notifications">Notifications</button>,
}))
vi.mock('@/features/notifications/hooks/use-realtime-notifications', () => ({
  useRealtimeNotifications: () => undefined,
}))

function renderShell(initialEntry = '/app') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/app" element={<div>Dashboard content</div>} />
          <Route path="/app/tasks" element={<div>Taskboard content</div>} />
          <Route path="/app/calendar" element={<div>Calendar content</div>} />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/login" element={<div>Login content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('authenticated application layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.isAuthenticated = true
  })

  it('renders the shared shell, role label, and configured sidebar navigation', () => {
    renderShell()

    expect(screen.getByRole('navigation', { name: 'Application navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Taskboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leave Requests' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Profile' })).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('highlights the active route and navigates without a page reload', async () => {
    const user = userEvent.setup()
    renderShell('/app/tasks')

    expect(screen.getByRole('link', { name: 'Taskboard' })).toHaveClass('bg-blue-50')
    await user.click(screen.getByRole('link', { name: 'Calendar' }))

    expect(screen.getByText('Calendar content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveClass('bg-blue-50')
  })

  it('opens the mobile navigation drawer and closes it after selecting a route', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Application navigation' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('link', { name: 'Taskboard' }))

    expect(screen.queryByRole('dialog', { name: 'Application navigation' })).not.toBeInTheDocument()
    expect(screen.getByText('Taskboard content')).toBeInTheDocument()
  })

  it('shows real profile data and uses the existing logout method', async () => {
    const user = userEvent.setup()
    renderShell('/app/profile')

    expect(screen.getByText('ada@office.local')).toBeInTheDocument()
    expect(screen.getByText('team-engineering')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'My Profile' })).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(mocks.auth.logout).toHaveBeenCalledOnce()
  })
})
