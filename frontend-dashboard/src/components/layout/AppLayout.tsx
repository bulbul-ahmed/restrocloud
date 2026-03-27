import { useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils'
import { useWaiterCalls } from '@/hooks/useWaiterCalls'
import { useOrderNotifications } from '@/hooks/useOrderNotifications'
import { settingsApi } from '@/lib/settings.api'
import { applyBrandColor } from '@/lib/theme'

export function AppLayout() {
  const { isAuthenticated, user } = useAuthStore()
  const { sidebarMobileOpen, closeMobileSidebar } = useUIStore()
  useWaiterCalls()
  useOrderNotifications()

  const restaurantId = user?.restaurantId ?? ''
  const { data: settings } = useQuery({
    queryKey: ['settings', restaurantId],
    queryFn: () => settingsApi.get(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    applyBrandColor(settings?.brandColor)
  }, [settings?.brandColor])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {sidebarMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
