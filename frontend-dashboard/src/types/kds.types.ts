export type KitchenStatus = 'QUEUED' | 'ACKNOWLEDGED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED'
export type KDSChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'QR' | 'ONLINE' | 'KIOSK' | 'AGGREGATOR'

export interface KDSOrderItem {
  id: string
  name: string
  quantity: number
  notes: string | null
  kitchenStatus: KitchenStatus
  isVoid: boolean
  modifiers: { name: string }[]
}

export interface KDSQueueEntry {
  orderId: string
  orderNumber: string
  channel: KDSChannel
  orderStatus: string
  overallKitchenStatus: KitchenStatus
  tableNumber: string | null
  elapsedSeconds: number
  createdAt: string
  acceptedAt: string | null
  notes: string | null
  items: KDSOrderItem[]
}

export interface KDSHistoryEntry {
  orderId: string
  orderNumber: string
  channel: KDSChannel
  orderStatus: string
  tableNumber: string | null
  readyAt: string
  createdAt: string
  prepSeconds: number | null
  items: {
    id: string
    name: string
    quantity: number
    kitchenStatus: KitchenStatus
  }[]
}

export interface KDSStats {
  today: {
    totalOrders: number
    completedWithTiming: number
    avgPrepSeconds: number | null
    avgPrepMinutes: number | null
  }
  activeItems: {
    queued: number
    acknowledged: number
    preparing: number
    ready: number
  }
}
