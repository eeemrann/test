import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { AppSidebar } from '@/layouts/components/app-sidebar'

type MobileSidebarProps = {
  open: boolean
  onClose: () => void
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close navigation"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative flex h-full w-[min(21rem,88vw)] flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Application navigation"
      >
        <div className="absolute right-3 top-3 z-10">
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close navigation">
            <X aria-hidden="true" />
          </Button>
        </div>
        <AppSidebar collapsed={false} onToggle={onClose} onNavigate={onClose} mobile />
      </div>
    </div>
  )
}
