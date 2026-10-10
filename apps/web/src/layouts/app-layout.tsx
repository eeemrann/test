import { Building2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { AppHeader } from '@/layouts/components/app-header'
import { AppSidebar } from '@/layouts/components/app-sidebar'
import { MobileSidebar } from '@/layouts/components/mobile-sidebar'
import { cn } from '@/lib/utils'
import { useRealtimeNotifications } from '@/features/notifications/hooks/use-realtime-notifications'

export function AppLayout() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isApplicationArea = location.pathname.startsWith('/app')
  useRealtimeNotifications({ userId: auth.currentUser?.id, isAuthenticated: auth.isAuthenticated })

  const closeMobileSidebar = useCallback(() => setIsMobileSidebarOpen(false), [])

  useEffect(() => {
    const closeTimer = window.setTimeout(closeMobileSidebar, 0)

    return () => window.clearTimeout(closeTimer)
  }, [closeMobileSidebar, location.pathname])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const result = await auth.logout()
    navigate('/login', {
      replace: true,
      state: result.warning ? { logoutWarning: result.warning } : undefined,
    })
    setIsLoggingOut(false)
  }

  if (!isApplicationArea) {
    return (
      <div className="relative min-h-svh overflow-hidden bg-slate-50">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,rgba(14,116,144,0.16),transparent_55%),radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_48%)]" />
        <header className="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
            <NavLink to="/" className="flex items-center gap-3" aria-label="Office Management home">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold tracking-tight text-slate-950">Office Management</span>
                <span className="block text-xs text-slate-500">Operations workspace</span>
              </span>
            </NavLink>
            <NavLink
              to={auth.isAuthenticated ? '/app' : '/login'}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {auth.isAuthenticated ? 'Open workspace' : 'Sign in'}
            </NavLink>
          </div>
        </header>
        <main className="relative mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh bg-slate-50">
      <div className="sticky top-0 hidden h-svh shrink-0 lg:block">
        <AppSidebar collapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed((value) => !value)} />
      </div>
      <MobileSidebar open={isMobileSidebarOpen} onClose={closeMobileSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          pathname={location.pathname}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onLogout={() => void handleLogout()}
          isLoggingOut={isLoggingOut}
        />
        <main className={cn('min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-9 xl:px-10')}>
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
