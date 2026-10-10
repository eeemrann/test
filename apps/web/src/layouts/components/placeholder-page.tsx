import { Clock3, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/layouts/components/page-header'

type PlaceholderPageProps = {
  title: string
  description: string
  icon: LucideIcon
  eyebrow?: string
}

export function PlaceholderPage({ title, description, icon, eyebrow = 'Module foundation' }: PlaceholderPageProps) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} icon={icon} />
      <Card className="border-dashed border-slate-300 bg-white/75 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center sm:py-24">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Clock3 className="size-6" aria-hidden="true" />
          </span>
          <div className="max-w-md space-y-2">
            <Badge variant="outline">Coming in a future phase</Badge>
            <h2 className="text-lg font-semibold text-slate-950">{title} is being prepared</h2>
            <p className="text-sm leading-6 text-slate-600">This space is ready for the next backend and product workflow. No incomplete actions are exposed here yet.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
