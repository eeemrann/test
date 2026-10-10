import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthLoading } from '@/features/auth/components/auth-loading'
import { SessionUnavailable } from '@/features/auth/components/session-unavailable'
import { useAuth } from '@/features/auth/hooks/use-auth'

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'initializing') {
    return <AuthLoading />
  }

  if (auth.status === 'unavailable') {
    return <SessionUnavailable message={auth.error} onRetry={() => void auth.refreshSession()} />
  }

  if (!auth.isAuthenticated || !auth.currentUser?.isActive) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
