import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DialogShellProps = PropsWithChildren<{
  open: boolean
  onClose: () => void
  title: string
  description?: string
  labelledBy?: string
  className?: string
  footer?: ReactNode
}>

export function DialogShell({
  open,
  onClose,
  title,
  description,
  labelledBy,
  className,
  footer,
  children,
}: DialogShellProps) {
  if (!open) return null

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <Dialog.Popup
            initialFocus
            className={cn(
              'max-h-[min(48rem,calc(100svh-2rem))] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl outline-none sm:rounded-3xl',
              className,
            )}
            aria-labelledby={labelledBy}
          >
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title id={labelledBy} className="text-lg font-semibold text-slate-950">{title}</Dialog.Title>
                  {description && <Dialog.Description className="mt-1 text-sm leading-5 text-slate-600">{description}</Dialog.Description>}
                </div>
                <Dialog.Close className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Close ${title}`}><X aria-hidden="true" /></Dialog.Close>
              </div>
            </div>
            <div className="p-5 sm:p-6">{children}</div>
            {footer && <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">{footer}</div>}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
