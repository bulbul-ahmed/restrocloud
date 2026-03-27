import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TopBar } from './TopBar'

interface PageShellProps {
  children: ReactNode
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
  className?: string
  fullWidth?: boolean
}

export function PageShell({
  children,
  title,
  breadcrumbs,
  actions,
  className,
  fullWidth = false,
}: PageShellProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title={title} breadcrumbs={breadcrumbs} />
      <main className={cn('flex-1 overflow-auto bg-surface-muted', className)}>
        <div className={cn('p-6', !fullWidth && 'max-w-7xl mx-auto')}>
          {(title || actions) && (
            <div className="flex items-center justify-between mb-6">
              {title && (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                </div>
              )}
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
