import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function AuthLoading() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center">
      <Card className="w-full border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/40">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
