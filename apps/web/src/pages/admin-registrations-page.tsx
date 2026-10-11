import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { approveRegistration, getRegistrations, getTeams, rejectRegistration } from '@/features/admin/api/admin-api'
import { getApiErrorMessage } from '@/lib/api'

export function AdminRegistrationsPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [teamByUser, setTeamByUser] = useState<Record<string, string>>({})
  const registrations = useQuery({ queryKey: ['admin', 'registrations', status], queryFn: () => getRegistrations(status), enabled: auth.currentUser?.role === 'ADMIN' })
  const teams = useQuery({ queryKey: ['admin', 'teams'], queryFn: getTeams, enabled: auth.currentUser?.role === 'ADMIN' })
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => action === 'approve' ? approveRegistration(id, teamByUser[id]) : rejectRegistration(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'registrations'] }) },
  })

  if (auth.currentUser?.role !== 'ADMIN') return <Card><CardContent className="p-6 text-sm text-slate-600">Administrator access is required.</CardContent></Card>
  const error = registrations.error ?? teams.error ?? mutation.error
  return <div className="space-y-6"><div><p className="text-sm font-medium text-blue-700">Administration</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Registration approvals</h1><p className="mt-2 text-sm text-slate-500">Approve employee registrations and optionally place them on a team. Role assignment is controlled by the server.</p></div><div className="flex flex-wrap gap-2">{(['PENDING', 'APPROVED', 'REJECTED'] as const).map((value) => <Button key={value} variant={status === value ? 'default' : 'outline'} onClick={() => setStatus(value)}>{value[0] + value.slice(1).toLowerCase()}</Button>)}</div>{error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{getApiErrorMessage(error)}<Button variant="link" className="text-rose-800" onClick={() => void registrations.refetch()}><RefreshCw className="mr-1 size-4" /> Retry</Button></div>}<Card className="border-slate-200/80 bg-white/95 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-blue-700" /> {status[0] + status.slice(1).toLowerCase()} accounts</CardTitle><CardDescription>Every decision is recorded in the registration audit log.</CardDescription></CardHeader><CardContent><div className="space-y-3">{registrations.isLoading ? <p className="text-sm text-slate-500">Loading registrations…</p> : registrations.data?.data.length === 0 ? <p className="py-6 text-sm text-slate-500">No {status.toLowerCase()} registrations.</p> : registrations.data?.data.map((registration) => <div key={registration.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-950">{registration.fullName}</p><Badge variant="outline">{registration.approvalStatus}</Badge></div><p className="mt-1 text-sm text-slate-600">{registration.email}</p><p className="mt-1 text-xs text-slate-500">Team: {registration.team?.name ?? 'Not assigned'}</p></div>{status === 'PENDING' && <div className="flex flex-col gap-2 sm:flex-row"><select aria-label={`Team for ${registration.fullName}`} value={teamByUser[registration.id] ?? ''} onChange={(event) => setTeamByUser({ ...teamByUser, [registration.id]: event.target.value })} className="h-9 rounded-lg border border-input bg-white px-3 text-sm"><option value="">No team</option>{(teams.data ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><Button disabled={mutation.isPending} onClick={() => mutation.mutate({ id: registration.id, action: 'approve' })}><Check className="mr-1 size-4" /> Approve</Button><Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: registration.id, action: 'reject' })}><X className="mr-1 size-4" /> Reject</Button></div>}</div>)}</div></CardContent></Card></div>
}
