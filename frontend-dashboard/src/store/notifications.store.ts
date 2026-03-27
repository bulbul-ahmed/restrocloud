import { create } from 'zustand'

export interface OrderNotification {
  id: string           // orderId
  orderNumber: string
  channel: string      // QR | ONLINE | POS
  tableNumber?: string | null
  items: Array<{ name: string; quantity: number }>
  totalAmount: number
  currency: string
  createdAt: string
  read: boolean
}

interface NotificationsState {
  notifications: OrderNotification[]
  unreadCount: number
  addNotification: (n: Omit<OrderNotification, 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    // Deduplicate by orderId
    if (get().notifications.some((x) => x.id === n.id)) return
    const entry: OrderNotification = { ...n, read: false }
    set((s) => ({
      notifications: [entry, ...s.notifications].slice(0, 50), // keep latest 50
      unreadCount: s.unreadCount + 1,
    }))
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id && !n.read ? { ...n, read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - (s.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}))
