import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TaskActionFeedbackProps = {
  message: string | null
  onDismiss: () => void
}

export function TaskActionFeedback({ message, onDismiss }: TaskActionFeedbackProps) {
  if (!message) return null
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status" aria-live="polite">
      <span className="flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />{message}</span>
      <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss} aria-label="Dismiss message"><X aria-hidden="true" /></Button>
    </div>
  )
}
