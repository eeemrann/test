import { Bell, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useUnreadCount } from '@/features/notifications/hooks/use-unread-count'
import { NotificationPopover } from '@/features/notifications/components/notification-popover'

export function NotificationBell() {
  const auth = useAuth()
  const userId = auth.currentUser?.id
  const [openForUserId, setOpenForUserId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadCount = useUnreadCount({ userId, enabled: auth.isAuthenticated })
  const count = unreadCount.data?.count ?? 0

  useEffect(() => {
    if (!openForUserId || openForUserId !== userId) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpenForUserId(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenForUserId(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openForUserId, userId])

  const open = Boolean(userId && openForUserId === userId && auth.isAuthenticated)

  const label = unreadCount.isError ? 'Notifications unavailable' : count > 0 ? `Notifications, ${count > 99 ? '99 plus' : count} unread` : 'Notifications, none unread'

  return (
    <div ref={containerRef} className="relative">
      <Button type="button" variant="ghost" size="icon" aria-label={label} aria-expanded={open} aria-haspopup="dialog" aria-busy={unreadCount.isLoading} onClick={() => setOpenForUserId((current) => current === userId ? null : userId ?? null)}>
        {unreadCount.isLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Bell aria-hidden="true" />}
        {count > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 translate-x-1/4 items-center justify-center rounded-full bg-rose-600 px-1 text-[0.62rem] font-bold leading-4 text-white ring-2 ring-white">{count > 99 ? '99+' : count}</span>}
      </Button>
      {open && userId && <NotificationPopover userId={userId} onClose={() => setOpenForUserId(null)} />}
    </div>
  )
}
