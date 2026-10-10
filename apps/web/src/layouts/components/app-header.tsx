import { Bell, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { getNavigationItem } from '@/config/navigation'
import { UserMenu } from '@/layouts/components/user-menu'

type AppHeaderProps = {
  pathname: string
  onOpenMobileMenu: () => void
  onLogout: () => void
  isLoggingOut: boolean
}

export function AppHeader({ pathname, onOpenMobileMenu, onLogout, isLoggingOut }: AppHeaderProps) {
  const currentItem = getNavigationItem(pathname)
  const title = currentItem?.label ?? 'Workspace'

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Open navigation">
          <Menu aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{title}</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">Office Management / {title}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          render={<Link to="/app/notifications" />}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" />
        </Button>
        <UserMenu onLogout={onLogout} isLoggingOut={isLoggingOut} />
      </div>
    </header>
  )
}
