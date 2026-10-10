import { BellOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function NotificationEmptyState({ unreadOnly = false }: { unreadOnly?: boolean }) {
  return (
    <Card className="border-dashed border-slate-300 bg-white/75 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><BellOff className="size-5" aria-hidden="true" /></span>
        <div className="space-y-1"><h2 className="font-semibold text-slate-950">{unreadOnly ? 'You are all caught up' : 'No notifications yet'}</h2><p className="text-sm text-slate-500">{unreadOnly ? 'There are no unread notifications for your account.' : 'New task and workspace updates will appear here.'}</p></div>
      </CardContent>
    </Card>
  )
}
