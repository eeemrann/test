import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TaskActionFeedbackProps = {
  message: string | null
  onDismiss: () => void
  variant?: 'success' | 'error'
}

export function TaskActionFeedback({ message, onDismiss, variant = 'success' }: TaskActionFeedbackProps) {
  if (!message) return null
  const isError = variant === 'error'
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${isError ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role={isError ? 'alert' : 'status'} aria-live="polite">
      <span className="flex items-center gap-2">{isError ? <AlertCircle className="size-4 shrink-0 text-rose-600" aria-hidden="true" /> : <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />}{message}</span>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss} aria-label="Dismiss message"><X aria-hidden="true" /></Button>
    </div>
  )
}
