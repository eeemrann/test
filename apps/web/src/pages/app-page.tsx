import { ArrowRight, CheckCircle2, ClipboardList, Layers3, ShieldCheck, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getRoleLabel } from '@/features/auth/role-labels'
import { PageHeader } from '@/layouts/components/page-header'

const moduleCards = [
  {
    title: 'Taskboard',
    description: 'Coordinate work, priorities, and ownership in one focused workspace.',
    to: '/app/tasks',
    icon: ClipboardList,
  },
  {
    title: 'Workplace',
    description: 'Attendance, leave requests, complaints, and announcements will live here.',
    to: '/app/attendance',
    icon: UsersRound,
  },
  {
    title: 'Personal space',
    description: 'Review your notifications, profile, and workspace preferences.',
    to: '/app/profile',
    icon: ShieldCheck,
  },
]

export function AppPage() {
  const auth = useAuth()

  if (!auth.currentUser) return null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`Good to see you, ${auth.currentUser.fullName}.`}
        description="Your office workspace is ready. Choose a module below to continue where your work happens."
        icon={Layers3}
        action={<Badge className="w-fit bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 aria-hidden="true" />Authenticated</Badge>}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Account summary">
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Current role</CardDescription>
            <CardTitle className="text-xl">{getRoleLabel(auth.currentUser.role)}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-slate-500">Permissions continue to be enforced by the NestJS API.</p></CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader>
            <CardDescription>Team</CardDescription>
            <CardTitle className="text-xl">{auth.currentUser.teamId ?? 'Not assigned'}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-slate-500">Your team information comes from the authenticated user record.</p></CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardDescription>Workspace status</CardDescription>
            <CardTitle className="text-xl">Ready to explore</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-slate-500">No fabricated task statistics are shown until live module data is available.</p></CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="available-modules-heading">
        <div>
          <h2 id="available-modules-heading" className="text-lg font-semibold text-slate-950">Available modules</h2>
          <p className="mt-1 text-sm text-slate-500">The application shell is ready for each workflow to arrive in its own phase.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {moduleCards.map(({ title, description, to, icon: Icon }) => (
            <Link key={title} to={to} className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Card className="h-full border-slate-200/80 bg-white/90 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:shadow-md">
                <CardHeader>
                  <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-1 text-sm font-medium text-blue-700">
                  Explore module <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
