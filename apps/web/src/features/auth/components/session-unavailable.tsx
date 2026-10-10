import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SessionUnavailableProps = {
  message: string | null
  onRetry: () => void
}

export function SessionUnavailable({ message, onRetry }: SessionUnavailableProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center">
      <Card className="w-full border-amber-200 bg-white/90 shadow-xl shadow-amber-100/40">
        <CardHeader className="items-center text-center">
          <TriangleAlert className="size-8 text-amber-600" aria-hidden="true" />
          <CardTitle>Session verification is unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm leading-6 text-slate-600">
            {message ?? 'The backend could not verify your session. You can retry without losing your local work.'}
          </p>
          <Button type="button" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Retry verification
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
