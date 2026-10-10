import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { queryClient } from '@/lib/query-client'
import {
  getApiErrorMessage,
  invalidateSession,
  isUnauthorizedError,
  refreshAccessToken,
  registerAuthFailureListener,
  activateSession,
} from '@/lib/api'
import { authApi } from '@/features/auth/api/auth-api'
import type {
  AuthStatus,
  AuthUser,
  LoginCredentials,
  LogoutResult,
} from '@/features/auth/types/auth.types'

type AuthContextValue = {
  status: AuthStatus
  currentUser: AuthUser | null
  isAuthenticated: boolean
  isLoggingIn: boolean
  error: string | null
  sessionNotice: string | null
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => Promise<LogoutResult>
  refreshSession: () => Promise<void>
  clearSessionNotice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function clearPrivateQueryState(): Promise<void> {
  await queryClient.cancelQueries()
  queryClient.clear()
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleAuthFailure = useCallback(() => {
    setCurrentUser(null)
    setStatus('unauthenticated')
    setError('Your session has expired. Please sign in again.')
    void clearPrivateQueryState()
  }, [])

  useEffect(() => registerAuthFailureListener(handleAuthFailure), [handleAuthFailure])

  const refreshSession = useCallback(async () => {
    setStatus('initializing')
    setError(null)

    try {
      await refreshAccessToken(true)
      const user = await authApi.getCurrentUser()

      if (!user.isActive) {
        invalidateSession()
        setCurrentUser(null)
        setStatus('unauthenticated')
        return
      }

      setCurrentUser(user)
      setStatus('authenticated')
    } catch (refreshError) {
      if (isUnauthorizedError(refreshError)) {
        invalidateSession()
        setCurrentUser(null)
        setStatus('unauthenticated')
        return
      }

      setStatus('unavailable')
      setError(getApiErrorMessage(refreshError))
    }
  }, [])

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      void refreshSession()
    }, 0)

    return () => window.clearTimeout(restoreTimer)
  }, [refreshSession])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoggingIn(true)
    setError(null)
    setSessionNotice(null)

    try {
      const result = await authApi.login(credentials)
      activateSession(result.accessToken)
      const user = await authApi.getCurrentUser()

      if (!user.isActive) {
        invalidateSession()
        setCurrentUser(null)
        setStatus('unauthenticated')
        setError('This account is inactive.')
        return false
      }

      setCurrentUser(user)
      setStatus('authenticated')
      return true
    } catch (loginError) {
      invalidateSession()
      setCurrentUser(null)

      if (isUnauthorizedError(loginError)) {
        setStatus('unauthenticated')
        setError('Invalid email or password.')
      } else {
        setStatus('unavailable')
        setError(getApiErrorMessage(loginError))
      }

      return false
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  const logout = useCallback(async (): Promise<LogoutResult> => {
    invalidateSession()
    setCurrentUser(null)
    setStatus('unauthenticated')
    setError(null)
    await clearPrivateQueryState()

    try {
      await authApi.logout()
      setSessionNotice(null)
      return { serverRevoked: true }
    } catch {
      const warning =
        'You were signed out on this device, but the server session could not be confirmed as revoked. Try signing out again when the backend is available.'
      setSessionNotice(warning)
      return { serverRevoked: false, warning }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      currentUser,
      isAuthenticated: status === 'authenticated' && currentUser !== null,
      isLoggingIn,
      error,
      sessionNotice,
      login,
      logout,
      refreshSession,
      clearSessionNotice: () => setSessionNotice(null),
    }),
    [currentUser, error, isLoggingIn, login, logout, refreshSession, sessionNotice, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
