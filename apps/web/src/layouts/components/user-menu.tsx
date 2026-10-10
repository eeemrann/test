import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getRoleLabel } from '@/features/auth/role-labels'
import { cn } from '@/lib/utils'

type UserMenuProps = {
  onLogout: () => void
  isLoggingOut: boolean
}

function getInitials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu({ onLogout, isLoggingOut }: UserMenuProps) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!auth.currentUser) return null

  const { currentUser } = auth

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="h-auto gap-2 rounded-xl px-2 py-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700" aria-hidden="true">
          {getInitials(currentUser.fullName)}
        </span>
        <span className="hidden max-w-32 text-left sm:block">
          <span className="block truncate text-xs font-semibold text-slate-900">{currentUser.fullName}</span>
          <span className="block truncate text-[0.68rem] text-slate-500">{getRoleLabel(currentUser.role)}</span>
        </span>
        <ChevronDown className={cn('size-4 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/50" role="menu">
          <div className="border-b border-slate-100 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-slate-950">{currentUser.fullName}</p>
            <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
            <Badge variant="outline" className="mt-2">{getRoleLabel(currentUser.role)}</Badge>
          </div>
          <div className="space-y-1 py-2">
            <Link
              to="/app/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <UserRound className="size-4 text-slate-400" aria-hidden="true" />
              My Profile
            </Link>
            <Link
              to="/app/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Settings className="size-4 text-slate-400" aria-hidden="true" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-700 outline-none hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {isLoggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
