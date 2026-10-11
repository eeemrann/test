import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3, LogIn, LogOut, RefreshCw, UsersRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { checkIn, checkOut, getAttendanceOverview, getAttendanceToday, getMyAttendance, getTeamAttendance } from '@/features/attendance/api/attendance-api'
import type { AttendanceStatus } from '@/features/attendance/types/attendance.types'
import { getApiErrorMessage } from '@/lib/api'

function currentDhakaMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

function formatTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

function formatOfficeTime(value: string) {
  const [hourValue, minuteValue] = value.split(':')
  const hour = Number(hourValue)
  if (!Number.isInteger(hour) || !minuteValue) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteValue} ${suffix}`
}

function statusLabel(status: AttendanceStatus) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const positive = status === 'PRESENT' || status === 'CHECKED_OUT'
  const warning = status === 'LATE'
  return <Badge className={positive ? 'bg-emerald-600 hover:bg-emerald-600' : warning ? 'bg-amber-500 hover:bg-amber-500' : status === 'MISSED' ? 'bg-rose-600 hover:bg-rose-600' : 'bg-slate-500 hover:bg-slate-500'}>{statusLabel(status)}</Badge>
}

export function AttendancePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentDhakaMonth)
  const isAdmin = auth.currentUser?.role === 'ADMIN'
  const isManager = auth.currentUser?.role === 'MANAGER'
  const todayQuery = useQuery({ queryKey: ['attendance', 'today'], queryFn: getAttendanceToday, enabled: Boolean(auth.currentUser) && !isAdmin })
  const mineQuery = useQuery({ queryKey: ['attendance', 'mine', month], queryFn: () => getMyAttendance(month), enabled: Boolean(auth.currentUser) && !isAdmin })
  const overviewQuery = useQuery({ queryKey: ['attendance', 'overview', month, auth.currentUser?.role], queryFn: () => getAttendanceOverview(month), enabled: Boolean(auth.currentUser) && (isAdmin || isManager) })
  const teamQuery = useQuery({ queryKey: ['attendance', 'team', month], queryFn: () => getTeamAttendance(month), enabled: Boolean(auth.currentUser) && isManager })
  const mutation = useMutation({
    mutationFn: (action: 'check-in' | 'check-out') => action === 'check-in' ? checkIn() : checkOut(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', 'mine'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', 'team'] }),
      ])
    },
  })

  const loading = (!isAdmin && (todayQuery.isLoading || mineQuery.isLoading || (isManager && teamQuery.isLoading))) || (isAdmin && overviewQuery.isLoading)
  const error = todayQuery.error ?? mineQuery.error ?? overviewQuery.error ?? teamQuery.error ?? mutation.error
  const today = todayQuery.data
  const summary = mineQuery.data?.summary
  const history = mineQuery.data?.data ?? []
  const overview = overviewQuery.data
  const teamEntries = teamQuery.data?.data ?? []
  const retry = () => {
    mutation.reset()
    void todayQuery.refetch()
    void mineQuery.refetch()
    void overviewQuery.refetch()
    void teamQuery.refetch()
  }
  const overviewStats = useMemo(() => overview ? [
    ['Approved active staff', overview.totalApprovedActiveStaff],
    ['Checked in today', overview.checkedInStaff],
    ['Late today', overview.lateStaff],
    ['Not checked in yet', overview.notYetCheckedIn],
  ] as const : [], [overview])

  if (!auth.currentUser) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-blue-700">Workplace module</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Attendance</h1><p className="mt-2 text-sm text-slate-500">Office time is evaluated by the server in Asia/Dhaka.</p></div>
        <label className="space-y-2 text-sm font-medium text-slate-700">Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="block h-10 rounded-lg border border-input bg-white px-3 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      </div>

      {loading && <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><span>{getApiErrorMessage(error)}</span><Button variant="link" className="text-rose-800" onClick={retry}><RefreshCw className="mr-1 size-4" /> Retry</Button></div>}

      {!loading && !error && isAdmin && overview && <AdminOverview overview={overview} stats={overviewStats} />}

      {!loading && !error && !isAdmin && today && <TodayCard today={today} pendingAction={mutation.isPending ? mutation.variables : undefined} onAction={(action) => mutation.mutate(action)} />}

      {!loading && !error && !isAdmin && summary && <SummaryCards summary={summary} />}
      {!loading && !error && !isAdmin && <HistoryCard history={history} />}
      {!loading && !error && isManager && <TeamAttendanceCard entries={teamEntries} />}
    </div>
  )
}

function TodayCard({ today, pendingAction, onAction }: { today: NonNullable<ReturnType<typeof getAttendanceToday> extends Promise<infer T> ? T : never>; pendingAction: 'check-in' | 'check-out' | undefined; onAction: (action: 'check-in' | 'check-out') => void }) {
  const canCheckIn = today.status === 'NOT_CHECKED_IN'
  const canCheckOut = today.status === 'PRESENT' || today.status === 'LATE'
  return <Card className="border-slate-200/80 bg-white/95 shadow-sm"><CardHeader><div className="flex items-center justify-between gap-4"><div><CardDescription>Today · {formatDate(today.date)}</CardDescription><CardTitle className="mt-1 flex items-center gap-2 text-xl"><Clock3 className="size-5 text-blue-700" /> {today.status === 'NOT_CHECKED_IN' ? 'Not checked in' : statusLabel(today.status)}</CardTitle><p className="mt-1 text-xs text-slate-500">Arrivals after {formatOfficeTime(today.officeHours.gracePeriodEnds)} are marked late.</p></div><StatusBadge status={today.status} /></div></CardHeader><CardContent><div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2"><div>Office start <span className="font-medium text-slate-900">{formatOfficeTime(today.officeHours.start)}</span></div><div>Late after <span className="font-medium text-slate-900">{formatOfficeTime(today.officeHours.gracePeriodEnds)}</span></div><div>Check-in <span className="font-medium text-slate-900">{formatTime(today.checkInAt)}</span></div><div>Check-out <span className="font-medium text-slate-900">{formatTime(today.checkOutAt)}</span></div></div><div className="mt-5 flex flex-wrap gap-2" aria-live="polite">{canCheckIn && <Button onClick={() => onAction('check-in')} disabled={Boolean(pendingAction) || !today.isWorkingDay}><LogIn className="mr-2 size-4" /> {pendingAction === 'check-in' ? 'Checking in…' : 'Check in'}</Button>}{canCheckOut && <Button onClick={() => onAction('check-out')} disabled={Boolean(pendingAction)}><LogOut className="mr-2 size-4" /> {pendingAction === 'check-out' ? 'Checking out…' : 'Check out'}</Button>}{today.status === 'CHECKED_OUT' && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Checkout completed for today.</p>}{!today.isWorkingDay && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">Today is not a scheduled working day.</p>}</div></CardContent></Card>
}

function SummaryCards({ summary }: { summary: NonNullable<ReturnType<typeof getMyAttendance> extends Promise<infer T> ? T : never>['summary'] }) {
  const cards = [
    ['Present days', summary.totalPresentDays, `${summary.totalLateDays} late included`],
    ['Late days', summary.totalLateDays, 'Also counted as present'],
    ['Missed days', summary.totalMissedDays, 'Scheduled days without check-in'],
    ['Scheduled days', summary.totalScheduledWorkingDays, `${summary.attendancePercentage}% attendance`],
  ] as const
  return <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Attendance summary">{cards.map(([label, value, detail]) => <Card key={label} className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader><CardContent className="text-xs text-slate-500">{detail}</CardContent></Card>)}</section>
}

function HistoryCard({ history }: { history: Array<{ date: string; day: string; status: AttendanceStatus; checkInAt: string | null; checkOutAt: string | null }> }) {
  return <Card className="border-slate-200/80 bg-white/95 shadow-sm"><CardHeader><CardTitle>Monthly history</CardTitle><CardDescription>Completed scheduled days without a check-in are marked missed. The current day is never finalized as missed.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table aria-label="Monthly attendance history" className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-3 py-3">Date</th><th scope="col" className="px-3 py-3">Day</th><th scope="col" className="px-3 py-3">Check-in</th><th scope="col" className="px-3 py-3">Check-out</th><th scope="col" className="px-3 py-3">Status</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.date} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-medium text-slate-900">{formatDate(entry.date)}</td><td className="px-3 py-3 text-slate-600">{entry.day}</td><td className="px-3 py-3 text-slate-600">{formatTime(entry.checkInAt)}</td><td className="px-3 py-3 text-slate-600">{formatTime(entry.checkOutAt)}</td><td className="px-3 py-3"><StatusBadge status={entry.status} /></td></tr>)}</tbody></table>{history.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No attendance history for this month.</p>}</div></CardContent></Card>
}

function AdminOverview({ overview, stats }: { overview: NonNullable<ReturnType<typeof getAttendanceOverview> extends Promise<infer T> ? T : never>; stats: readonly (readonly [string, number])[] }) {
  const monthlyStats = [['Present days', overview.monthlySummary.present], ['Late days', overview.monthlySummary.late], ['Missed days', overview.monthlySummary.missed], ['Scheduled days', overview.monthlySummary.scheduled]] as const
  return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Attendance overview">{stats.map(([label, value]) => <Card key={label} className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader><CardContent className="text-xs text-slate-500">{overview.isWorkingDay ? 'Office-local status today' : 'Non-working day'}</CardContent></Card>)}</section><section className="space-y-3" aria-labelledby="monthly-attendance-summary"><div><h2 id="monthly-attendance-summary" className="text-lg font-semibold text-slate-950">Monthly attendance summary</h2><p className="mt-1 text-sm text-slate-500">Approved employee and manager records for the selected month.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{monthlyStats.map(([label, value]) => <Card key={label} className="border-slate-200/80 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader><CardContent className="text-xs text-slate-500">Selected month</CardContent></Card>)}</div></section><Card className="border-slate-200/80 bg-white/95 shadow-sm"><CardHeader><CardTitle>Staff observation</CardTitle><CardDescription>Read-only attendance observation. Admin accounts are exempt from daily check-in.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto">{overview.staff.length === 0 ? <p className="py-6 text-sm text-slate-500">No approved staff records for this month.</p> : <table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-3 py-3">Staff member</th><th scope="col" className="px-3 py-3">Role</th><th scope="col" className="px-3 py-3">Check-in</th><th scope="col" className="px-3 py-3">Check-out</th><th scope="col" className="px-3 py-3">Status</th></tr></thead><tbody>{overview.staff.map((person) => <tr key={person.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3"><p className="font-medium text-slate-900">{person.fullName}</p><p className="text-xs text-slate-500">{person.email}</p></td><td className="px-3 py-3 text-slate-600">{person.role}</td><td className="px-3 py-3 text-slate-600">{formatTime(person.checkInAt)}</td><td className="px-3 py-3 text-slate-600">{formatTime(person.checkOutAt)}</td><td className="px-3 py-3"><StatusBadge status={person.status} /></td></tr>)}</tbody></table>}</div></CardContent></Card></div>
}

function TeamAttendanceCard({ entries }: { entries: Array<{ date: string; status: AttendanceStatus; checkInAt: string; checkOutAt: string | null; user: { fullName: string } }> }) {
  return <Card className="border-slate-200/80 bg-white/95 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="size-5 text-blue-700" /> Team attendance records</CardTitle><CardDescription>Only attendance records from your authorized team are shown.</CardDescription></CardHeader><CardContent><div className="space-y-2">{entries.length === 0 ? <p className="py-6 text-sm text-slate-500">No team attendance records for this month.</p> : entries.map((entry) => <div key={`${entry.user.fullName}-${entry.date}`} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-slate-900">{entry.user.fullName}</p><p className="text-xs text-slate-500">{formatDate(entry.date)} · {formatTime(entry.checkInAt)} – {formatTime(entry.checkOutAt)}</p></div><StatusBadge status={entry.status} /></div>)}</div></CardContent></Card>
}
