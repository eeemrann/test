import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description: string
  icon: LucideIcon
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-slate-200/80 pb-7 sm:flex-row sm:items-end">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1.5">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {action}
    </div>
  )
}
