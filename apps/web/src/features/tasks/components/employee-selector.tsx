import { Search, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { flattenAssignableUsers, useAssignableUsers } from '@/features/tasks/hooks/use-assignable-users'

type EmployeeSelectorProps = {
  id: string
  value: string
  onChange: (userId: string) => void
  restrictToTeamId?: string | null
  disabled?: boolean
  error?: string
  purpose?: 'create' | 'reassign'
}

export function EmployeeSelector({ id, value, onChange, restrictToTeamId, disabled = false, error, purpose = 'create' }: EmployeeSelectorProps) {
  const auth = useAuth()
  const [search, setSearch] = useState('')
  const usersQuery = useAssignableUsers({ userId: auth.currentUser?.id, search, purpose })
  const users = useMemo(() => {
    const allUsers = flattenAssignableUsers(usersQuery.data?.pages)
    if (restrictToTeamId === undefined) return allUsers
    return allUsers.filter((user) => user.teamId === restrictToTeamId)
  }, [restrictToTeamId, usersQuery.data?.pages])
  const selected = users.find((user) => user.id === value)

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-search`} className="text-sm font-medium text-slate-800">Assign to</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          id={`${id}-search`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search eligible active users"
          className="h-10 pl-9"
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {restrictToTeamId === null ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Your account is not assigned to a team.</p>
      ) : usersQuery.isLoading ? (
        <div className="space-y-2" aria-label="Loading active employees"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
      ) : usersQuery.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Could not load active employees. Try again.
          <Button type="button" variant="link" className="ml-1 h-auto p-0 text-rose-800" onClick={() => void usersQuery.refetch()}>Retry</Button>
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No eligible active employees found.</p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2" role="listbox" aria-label="Eligible active users" aria-invalid={Boolean(error)}>
          {users.map((user) => {
            const isSelected = user.id === value
            return (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => onChange(user.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900"><UsersRound className="size-4 text-slate-500" aria-hidden="true" />{user.fullName}</span>
                <span className="mt-0.5 block pl-6 text-xs text-slate-500">{user.email} · {user.role ?? 'EMPLOYEE'} · {user.teamId ? 'Assigned team' : 'No team'}</span>
              </button>
            )
          })}
          {usersQuery.hasNextPage && <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled || usersQuery.isFetchingNextPage} onClick={() => void usersQuery.fetchNextPage()}>{usersQuery.isFetchingNextPage ? 'Loading…' : 'Load more employees'}</Button>}
        </div>
      )}
      {selected && <p className="text-xs text-slate-600" aria-live="polite">Selected: <span className="font-medium text-slate-900">{selected.fullName}</span></p>}
      {error && <p id={`${id}-error`} className="text-sm text-rose-700">{error}</p>}
    </div>
  )
}
