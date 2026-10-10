import { Navigate, Outlet } from 'react-router-dom'
import { AuthLoading } from '@/features/auth/components/auth-loading'
import { useAuth } from '@/features/auth/hooks/use-auth'

export function GuestRoute() {
  const auth = useAuth()

  if (auth.status === 'initializing') {
    return <AuthLoading />
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
