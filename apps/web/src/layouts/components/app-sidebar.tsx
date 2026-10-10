import { Building2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { getVisibleNavigation } from '@/config/navigation'
import { cn } from '@/lib/utils'

type AppSidebarProps = {
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
  mobile?: boolean
}

export function AppSidebar({ collapsed, onToggle, onNavigate, mobile = false }: AppSidebarProps) {
  const auth = useAuth()
  const groups = getVisibleNavigation(auth.currentUser?.role ?? null)

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-slate-200 bg-white',
        collapsed ? 'w-[5.25rem]' : 'w-64',
        mobile && 'w-full border-r-0',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-slate-100 px-4', collapsed && !mobile ? 'justify-center px-2' : 'justify-between')}>
        <NavLink
          to="/app"
          onClick={onNavigate}
          className={cn('flex min-w-0 items-center gap-3', collapsed && !mobile && 'justify-center')}
          aria-label="Office Management dashboard"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
            <Building2 className="size-4" aria-hidden="true" />
          </span>
          {(!collapsed || mobile) && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-slate-950">Office Management</span>
              <span className="block truncate text-xs text-slate-500">Operations workspace</span>
            </span>
          )}
        </NavLink>
        {!mobile && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(collapsed && 'absolute -right-3 top-5 z-10 rounded-full border border-slate-200 bg-white shadow-sm')}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>
        )}
      </div>

      <nav aria-label="Application navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`navigation-${group.label.toLowerCase()}`}>
              {(!collapsed || mobile) && (
                <h2 id={`navigation-${group.label.toLowerCase()}`} className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {group.label}
                </h2>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/app'}
                      onClick={onNavigate}
                      title={collapsed && !mobile ? item.label : item.description}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                          collapsed && !mobile && 'justify-center px-2',
                          isActive
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                        )
                      }
                    >
                      <Icon className="size-[1.1rem] shrink-0" aria-hidden="true" />
                      {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </aside>
  )
}
