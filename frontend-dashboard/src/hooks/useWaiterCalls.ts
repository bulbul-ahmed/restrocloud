import { useEffect } from 'react'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { createElement } from 'react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth.store'

interface WaiterCalledPayload {
  tableId: string
  tableNumber: string | null
  restaurantId: string
  message: string | null
  calledAt: string
}

/**
 * Listen for `waiter_called` WebSocket events and surface a persistent
 * sonner toast for every call. Staff dismiss individually.
 * Only active when the user is authenticated (has a token).
 */
export function useWaiterCalls() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()

    function onWaiterCalled(payload: WaiterCalledPayload) {
      const tableLabel = payload.tableNumber ? `Table ${payload.tableNumber}` : 'A table'
      const body = payload.message ? `"${payload.message}"` : 'Requesting assistance'

      toast(
        `${tableLabel} — Call Waiter`,
        {
          description: body,
          icon: createElement(Bell, { size: 18, className: 'text-orange-500' }),
          duration: Infinity,   // stays until staff dismisses
          closeButton: true,
          id: `waiter-${payload.tableId}-${payload.calledAt}`,
        },
      )

      // Also ring the browser notification if permitted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`${tableLabel} is calling a waiter`, {
          body,
          tag: `waiter-${payload.tableId}`,
          renotify: true,
        })
      }
    }

    socket.on('waiter_called', onWaiterCalled)
    return () => { socket.off('waiter_called', onWaiterCalled) }
  }, [isAuthenticated])
}
