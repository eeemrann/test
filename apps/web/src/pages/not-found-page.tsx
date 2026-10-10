import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/layouts/components/page-header'

export function NotFoundPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Navigation" title="Page not found" description="The page you requested does not exist in this workspace." icon={Compass} />
      <Card className="bg-white/80 shadow-sm">
        <CardContent className="flex flex-col items-start gap-4 px-6 py-8">
          <p className="text-sm text-slate-600">Use the application navigation to return to a supported module.</p>
          <Link to="/app" className={buttonVariants()}>
            <ArrowLeft aria-hidden="true" />Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
