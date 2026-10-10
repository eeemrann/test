import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Code2,
  Database,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api'
import { useDatabaseHealth } from '@/hooks/use-database-health'

export function SetupPage() {
  const { data, error, isError, isPending, isFetching, refetch } = useDatabaseHealth()
  const isConnected = data?.status === 'ok' && data.database === 'connected'

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="max-w-3xl space-y-5">
          <Badge variant="outline" className="gap-1.5 border-slate-300 bg-white/70 px-3 py-1 text-slate-600">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Foundation workspace
          </Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              A calmer way to run the office.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              The frontend foundation is ready for authentication, task coordination, and team communication.
              This setup check confirms the workspace can reach the NestJS backend.
            </p>
          </div>
        </div>

        <Card className="border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/40">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-cyan-700" aria-hidden="true" />
                Backend connection
              </CardTitle>
              <CardDescription className="mt-1">Live status from /health/database</CardDescription>
            </div>
            {isPending ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : (
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4" aria-live="polite">
              {isPending ? (
                <>
                  <Skeleton className="mt-0.5 size-5 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-52 max-w-full" />
                  </div>
                </>
              ) : isConnected ? (
                <>
                  <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-950">Backend Connected</p>
                    <p className="mt-1 text-sm text-slate-600">PostgreSQL is reachable through the NestJS API.</p>
                  </div>
                </>
              ) : (
                <>
                  <CircleAlert className="mt-0.5 size-5 text-rose-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-950">Backend Disconnected</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {isError ? getApiErrorMessage(error) : 'The connection status is unavailable.'}
                    </p>
                  </div>
                </>
              )}
            </div>
            {!isPending && !isConnected && (
              <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="w-full">
                <RefreshCw className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
                {isFetching ? 'Retrying…' : 'Retry connection'}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Project modules">
        <Card className="border-slate-200/80 bg-white/80 shadow-sm">
          <CardHeader>
            <Code2 className="mb-2 size-5 text-blue-700" aria-hidden="true" />
            <CardTitle>React foundation</CardTitle>
            <CardDescription>Vite, TypeScript, routing, and shared UI primitives are configured.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Explore the structure <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 shadow-sm">
          <CardHeader>
            <Database className="mb-2 size-5 text-cyan-700" aria-hidden="true" />
            <CardTitle>API ready</CardTitle>
            <CardDescription>Axios and TanStack Query provide a resilient data-fetching foundation.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Health check enabled <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/80 shadow-sm">
          <CardHeader>
            <Layers3 className="mb-2 size-5 text-violet-700" aria-hidden="true" />
            <CardTitle>Built to extend</CardTitle>
            <CardDescription>Auth, tasks, and notifications can arrive as focused feature modules.</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              Secure by default <ShieldCheck className="size-4 text-violet-600" aria-hidden="true" />
            </span>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
