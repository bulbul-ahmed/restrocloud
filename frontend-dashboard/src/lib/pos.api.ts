import { api } from './api'
import type { POSOverview, CurrentSession, SessionOrder } from '@/types/pos.types'

type Envelope<T> = { success: boolean; data: T }

// ── Floor plan ────────────────────────────────────────────────────────────────

export const posApi = {
  // GET /restaurants/:id/tables/overview
  overview: (restaurantId: string) =>
    api
      .get<Envelope<POSOverview>>(`/restaurants/${restaurantId}/tables/overview`)
      .then((r) => r.data.data),

  // ── Table status ────────────────────────────────────────────────────────────
  updateTableStatus: (restaurantId: string, tableId: string, status: string) =>
    api
      .patch<Envelope<unknown>>(
        `/restaurants/${restaurantId}/tables/${tableId}/status`,
        { status },
      )
      .then((r) => r.data.data),

  // ── Sessions ────────────────────────────────────────────────────────────────
  openSession: (restaurantId: string, tableId: string, dto: { guestCount?: number; notes?: string }) =>
    api
      .post<Envelope<CurrentSession>>(
        `/restaurants/${restaurantId}/tables/${tableId}/sessions`,
        dto,
      )
      .then((r) => r.data.data),

  getCurrentSession: (restaurantId: string, tableId: string) =>
    api
      .get<Envelope<CurrentSession>>(
        `/restaurants/${restaurantId}/tables/${tableId}/sessions/current`,
      )
      .then((r) => r.data.data),

  requestBill: (restaurantId: string, tableId: string) =>
    api
      .patch<Envelope<unknown>>(
        `/restaurants/${restaurantId}/tables/${tableId}/sessions/current/bill-request`,
      )
      .then((r) => r.data.data),

  closeSession: (restaurantId: string, tableId: string, sessionId: string, opts?: { notes?: string; force?: boolean }) =>
    api
      .patch<Envelope<unknown>>(
        `/restaurants/${restaurantId}/tables/${tableId}/sessions/${sessionId}/close`,
        opts,
      )
      .then((r) => r.data.data),

  // ── Orders ──────────────────────────────────────────────────────────────────
  createOrder: (
    restaurantId: string,
    dto: {
      channel?: string
      tableId?: string
      tableSessionId?: string
      notes?: string
      customerId?: string
      discountAmount?: number
      items: { itemId: string; quantity: number; notes?: string; modifiers?: { modifierId: string }[] }[]
    },
  ) =>
    api
      .post<Envelope<SessionOrder>>(`/restaurants/${restaurantId}/orders`, dto)
      .then((r) => r.data.data),

  addItemsToOrder: (
    restaurantId: string,
    orderId: string,
    items: { itemId: string; quantity: number; notes?: string; modifiers?: { modifierId: string }[] }[],
  ) =>
    api
      .post<Envelope<SessionOrder>>(
        `/restaurants/${restaurantId}/orders/${orderId}/items`,
        { items },
      )
      .then((r) => r.data.data),

  applyDiscount: (
    restaurantId: string,
    orderId: string,
    dto: { type: 'FLAT' | 'PERCENT'; value: number; reason?: string },
  ) =>
    api
      .patch<Envelope<SessionOrder>>(`/restaurants/${restaurantId}/orders/${orderId}/discount`, dto)
      .then((r) => r.data.data),

  transferSession: (restaurantId: string, tableId: string, targetTableId: string) =>
    api
      .patch<Envelope<{ success: boolean }>>(`/restaurants/${restaurantId}/tables/${tableId}/sessions/current/transfer`, { targetTableId })
      .then((r) => r.data.data),

  // ── Payments ─────────────────────────────────────────────────────────────────
  processPayment: (
    restaurantId: string,
    orderId: string,
    dto: { method: string; amount: number; notes?: string },
  ) =>
    api
      .post<Envelope<{ isFullyPaid: boolean }>>(
        `/restaurants/${restaurantId}/orders/${orderId}/payments`,
        dto,
      )
      .then((r) => r.data.data),

}
