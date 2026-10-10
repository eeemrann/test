import { CheckCircle2, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getRoleLabel } from '@/features/auth/role-labels'
import { PageHeader } from '@/layouts/components/page-header'

export function ProfilePage() {
  const auth = useAuth()

  if (!auth.currentUser) return null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Personal"
        title="My profile"
        description="Your account information as provided by the authenticated backend session."
        icon={UserRound}
      />

      <Card className="max-w-3xl border-slate-200/80 bg-white/90 shadow-sm">
        <CardHeader className="flex-row items-start gap-4 space-y-0">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-sm font-semibold text-blue-700">
            {auth.currentUser.fullName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <CardTitle>{auth.currentUser.fullName}</CardTitle>
            <CardDescription className="mt-1">Account details are read-only for now.</CardDescription>
          </div>
          <Badge className="ml-auto shrink-0 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 aria-hidden="true" />Active</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><Mail className="size-3.5" aria-hidden="true" />Email</div>
            <p className="mt-2 break-all font-medium text-slate-900">{auth.currentUser.email}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500"><ShieldCheck className="size-3.5" aria-hidden="true" />Role</div>
            <p className="mt-2 font-medium text-slate-900">{getRoleLabel(auth.currentUser.role)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Team identifier</p>
            <p className="mt-2 font-medium text-slate-900">{auth.currentUser.teamId ?? 'Not assigned'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Account status</p>
            <p className="mt-2 font-medium text-slate-900">{auth.currentUser.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
