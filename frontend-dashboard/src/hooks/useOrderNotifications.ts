import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getSocket } from '@/lib/socket'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationsStore } from '@/store/notifications.store'

interface NewOrderPayload {
  orderId: string
  orderNumber: string
  restaurantId: string
  channel: string
  tableNumber?: string | null
  items: Array<{ name: string; quantity: number }>
  totalAmount: number
  currency: string
  createdAt: string
}

function channelLabel(channel: string, tableNumber?: string | null): string {
  if (channel === 'QR' && tableNumber) return `QR · Table ${tableNumber}`
  if (channel === 'QR') return 'QR Order'
  if (channel === 'ONLINE') return 'Online Order'
  return 'POS Order'
}

function itemsSummary(items: Array<{ name: string; quantity: number }>): string {
  if (items.length === 0) return ''
  const first2 = items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(', ')
  const extra = items.length - 2
  return extra > 0 ? `${first2} +${extra} more` : first2
}

function navigatePath(channel: string): string {
  if (channel === 'QR') return '/pos'
  if (channel === 'ONLINE') return '/orders'
  return '/orders'
}

function playOrderChime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    // Three ascending tones: D5 → F#5 → A5
    const notes = [587, 740, 880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      const start = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.25, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.start(start)
      osc.stop(start + 0.35)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // AudioContext blocked before user gesture — silently ignore
  }
}

/**
 * Listens for `new_order` WebSocket events, adds them to the notifications
 * store, and fires a dismissable sonner toast with a click-to-navigate action.
 *
 * Also fetches unread NEW_ORDER notifications from the API on mount so the
 * bell badge stays accurate even if the socket event was missed (e.g. tab
 * was closed or user was on another page).
 */
export function useOrderNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const restaurantId = useAuthStore((s) => s.user?.restaurantId)
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const navigate = useNavigate()

  // Seed store from API on mount — catches notifications missed while offline/away
  useEffect(() => {
    if (!isAuthenticated || !restaurantId) return
    api
      .get(`/restaurants/${restaurantId}/notifications/me`, {
        params: { unreadOnly: true, limit: 30 },
      })
      .then((res) => {
        const list: any[] = res.data?.data?.data ?? []
        for (const n of list) {
          if (n.type !== 'NEW_ORDER') continue
          const d = n.data ?? {}
          if (!d.orderId) continue
          addNotification({
            id: d.orderId,
            orderNumber: d.orderNumber ?? '',
            channel: d.channel ?? 'ONLINE',
            tableNumber: d.tableNumber ?? null,
            items: d.items ?? [],
            totalAmount: d.totalAmount ?? 0,
            currency: d.currency ?? '',
            createdAt: n.createdAt,
          })
        }
      })
      .catch(() => { /* silent — live socket events still work */ })
  }, [isAuthenticated, restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live socket listener
  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()

    function onNewOrder(payload: NewOrderPayload) {
      playOrderChime()
      addNotification({
        id: payload.orderId,
        orderNumber: payload.orderNumber,
        channel: payload.channel,
        tableNumber: payload.tableNumber,
        items: payload.items,
        totalAmount: payload.totalAmount,
        currency: payload.currency,
        createdAt: payload.createdAt,
      })

      const label = channelLabel(payload.channel, payload.tableNumber)
      const summary = itemsSummary(payload.items)
      const amount = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
      }).format(payload.totalAmount)
      const path = navigatePath(payload.channel)

      toast(`New Order · ${label}`, {
        description: summary ? `${summary} — ${payload.currency} ${amount}` : `${payload.currency} ${amount}`,
        duration: 8000,
        closeButton: true,
        id: `order-${payload.orderId}`,
        action: {
          label: payload.channel === 'QR' ? 'Open POS' : 'View Orders',
          onClick: () => navigate(path),
        },
      })

      // Browser notification if tab is in background
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`New Order #${payload.orderNumber}`, {
          body: summary || label,
          tag: `order-${payload.orderId}`,
        })
      }
    }

    socket.on('new_order', onNewOrder)
    return () => { socket.off('new_order', onNewOrder) }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps
}
