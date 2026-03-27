import Dexie, { type Table } from 'dexie'
import type { Category, MenuItem } from '@/types/menu.types'
import type { POSOverview } from '@/types/pos.types'

// ── Schema types ───────────────────────────────────────────────────────────────

export interface MenuSnapshot {
  restaurantId: string // primary key
  categories: Category[]
  items: MenuItem[]
  cachedAt: number
}

export interface FloorSnapshot {
  restaurantId: string // primary key
  overview: POSOverview
  cachedAt: number
}

export interface OfflineOrder {
  id: string // uuid, primary key
  restaurantId: string
  payload: {
    channel?: string
    tableId?: string
    tableSessionId?: string
    notes?: string
    customerId?: string
    discountAmount?: number
    items: Array<{
      itemId: string
      quantity: number
      notes?: string
      modifiers?: Array<{ modifierId: string }>
    }>
  }
  queuedAt: number
  synced: boolean
}

// ── Database ──────────────────────────────────────────────────────────────────

class PosDatabase extends Dexie {
  menuSnapshot!: Table<MenuSnapshot>
  floorSnapshot!: Table<FloorSnapshot>
  offlineOrders!: Table<OfflineOrder>

  constructor() {
    super('restrocloud_pos')
    this.version(1).stores({
      menuSnapshot: 'restaurantId',
      floorSnapshot: 'restaurantId',
      offlineOrders: 'id, restaurantId',
    })
  }
}

export const posDb = new PosDatabase()
