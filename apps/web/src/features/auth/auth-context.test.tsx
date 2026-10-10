import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/features/auth/context/auth-context'
import { GuestRoute } from '@/features/auth/components/guest-route'
import { LoginForm } from '@/features/auth/components/login-form'
import { ProtectedRoute } from '@/features/auth/components/protected-route'
import { useAuth } from '@/features/auth/hooks/use-auth'
import type { AuthUser } from '@/features/auth/types/auth.types'

const mocks = vi.hoisted(() => ({
  authApi: {
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
  refreshAccessToken: vi.fn(),
  activateSession: vi.fn(),
  invalidateSession: vi.fn(),
  registerAuthFailureListener: vi.fn(() => vi.fn()),
  isUnauthorizedError: vi.fn((error: unknown) => {
    return Boolean((error as { response?: { status?: number } })?.response?.status === 401)
  }),
  getApiErrorMessage: vi.fn(() => 'The backend is temporarily unavailable.'),
}))

vi.mock('@/features/auth/api/auth-api', () => ({ authApi: mocks.authApi }))
vi.mock('@/lib/api', () => ({
  activateSession: mocks.activateSession,
  getApiErrorMessage: mocks.getApiErrorMessage,
  invalidateSession: mocks.invalidateSession,
  isUnauthorizedError: mocks.isUnauthorizedError,
  refreshAccessToken: mocks.refreshAccessToken,
  registerAuthFailureListener: mocks.registerAuthFailureListener,
}))

const testUser: AuthUser = {
  id: 'user-1',
  fullName: 'Ada Lovelace',
  email: 'ada@office.local',
  role: 'MANAGER',
  teamId: 'team-1',
  isActive: true,
}

function unauthorizedError() {
  return Object.assign(new Error('unauthorized'), {
    response: { status: 401 },
  })
}

function renderWithAuth(children: ReactNode, initialEntry = '/login') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function AuthState() {
  const auth = useAuth()
  return <div data-testid="auth-state">{auth.currentUser?.fullName ?? auth.status}</div>
}

function LogoutProbe() {
  const auth = useAuth()
  return <button onClick={() => void auth.logout()}>logout</button>
}

function setUnauthenticatedDefaults() {
  mocks.refreshAccessToken.mockRejectedValue(unauthorizedError())
  mocks.authApi.getCurrentUser.mockResolvedValue(testUser)
  mocks.authApi.login.mockResolvedValue({
    accessToken: 'login-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: testUser,
  })
  mocks.authApi.logout.mockResolvedValue(undefined)
}

describe('authentication UI and session state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    setUnauthenticatedDefaults()
  })

  it('renders the login form with accessible fields', async () => {
    renderWithAuth(<LoginForm />)

    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('rejects invalid email and empty password before calling the API', async () => {
    const user = userEvent.setup()
    renderWithAuth(<LoginForm />)

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid email')
    expect(mocks.authApi.login).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Email'), 'ada@office.local')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert')).toHaveTextContent('password')
    expect(mocks.authApi.login).not.toHaveBeenCalled()
  })

  it('toggles password visibility without storing the password', async () => {
    const user = userEvent.setup()
    renderWithAuth(<LoginForm />)
    const password = screen.getByLabelText('Password')

    await user.type(password, 'not-a-real-password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('calls login, updates authenticated state, and redirects to /app', async () => {
    const user = userEvent.setup()
    renderWithAuth(
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginForm />} />
        </Route>
        <Route path="/app" element={<div>Workspace loaded</div>} />
      </Routes>,
    )

    await user.type(await screen.findByLabelText('Email'), 'ADA@office.local')
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(screen.getByText('Workspace loaded')).toBeInTheDocument())
    expect(mocks.authApi.login).toHaveBeenCalledWith({
      email: 'ada@office.local',
      password: 'not-a-real-password',
    })
    expect(mocks.activateSession).toHaveBeenCalledWith('login-token')
  })

  it('shows a safe error for invalid credentials', async () => {
    const user = userEvent.setup()
    mocks.authApi.login.mockRejectedValueOnce(unauthorizedError())
    renderWithAuth(<LoginForm />)

    await user.type(await screen.findByLabelText('Email'), 'ada@office.local')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('restores an authenticated session from a successful refresh', async () => {
    mocks.refreshAccessToken.mockResolvedValue('restored-token')
    renderWithAuth(<AuthState />)

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('Ada Lovelace'))
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith(true)
    expect(mocks.authApi.getCurrentUser).toHaveBeenCalled()
  })

  it('redirects unauthenticated users away from protected routes after a 401 refresh', async () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<div>Private workspace</div>} />
        </Route>
        <Route path="/login" element={<div>Sign in route</div>} />
      </Routes>,
      '/app',
    )

    expect(await screen.findByText('Sign in route')).toBeInTheDocument()
    expect(screen.queryByText('Private workspace')).not.toBeInTheDocument()
  })

  it('shows a recoverable state for temporary refresh failures', async () => {
    mocks.refreshAccessToken.mockRejectedValue(new Error('network unavailable'))
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<div>Private workspace</div>} />
        </Route>
      </Routes>,
      '/app',
    )

    expect(await screen.findByText('Session verification is unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeInTheDocument()
  })

  it('redirects authenticated users away from the guest route', async () => {
    mocks.refreshAccessToken.mockResolvedValue('restored-token')
    renderWithAuth(
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<div>Login route</div>} />
        </Route>
        <Route path="/app" element={<div>App route</div>} />
      </Routes>,
    )

    expect(await screen.findByText('App route')).toBeInTheDocument()
    expect(screen.queryByText('Login route')).not.toBeInTheDocument()
  })

  it('logs out, clears private query data, and reports server logout failures safely', async () => {
    const user = userEvent.setup()
    mocks.refreshAccessToken.mockResolvedValue('restored-token')
    queryClient.setQueryData(['private'], { secret: 'not rendered' })
    renderWithAuth(
      <>
        <AuthState />
        <LogoutProbe />
      </>,
    )

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('Ada Lovelace'))
    mocks.authApi.logout.mockRejectedValueOnce(new Error('backend unavailable'))

    await user.click(await screen.findByRole('button', { name: 'logout' }))

    await waitFor(() => expect(queryClient.getQueryData(['private'])).toBeUndefined())
    expect(mocks.authApi.logout).toHaveBeenCalled()
    expect(mocks.invalidateSession).toHaveBeenCalled()
  })
})
