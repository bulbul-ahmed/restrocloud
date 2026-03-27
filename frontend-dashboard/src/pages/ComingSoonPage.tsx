import { useLocation } from 'react-router-dom'
import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent } from '@/components/ui/card'
import { Construction } from 'lucide-react'

export default function ComingSoonPage() {
  const location = useLocation()
  const module = location.pathname.split('/').filter(Boolean)[0] ?? 'this module'

  return (
    <PageShell>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 mx-auto mb-4">
              <Construction size={32} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2 capitalize">
              {module} coming soon
            </h2>
            <p className="text-gray-500 text-sm">
              This module is currently being built. It will be available once the corresponding
              backend module is verified.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
