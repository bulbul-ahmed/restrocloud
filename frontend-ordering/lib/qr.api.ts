import { apiFetch } from './api'
import type {
  QrContext,
  MenuCategory,
  Cart,
  PlacedOrder,
  OrderTracking,
  MenuItem,
  SessionSummary,
  TableCart,
} from '../types/qr.types'

const base = (restaurantId: string) => `/qr/${restaurantId}`

export const qrApi = {
  resolveTable: (restaurantId: string, tableId: string): Promise<QrContext> =>
    apiFetch(`${base(restaurantId)}/${tableId}`),

  getMenu: (restaurantId: string): Promise<MenuCategory[]> =>
    apiFetch(`${base(restaurantId)}/menu`),

  getItemDetail: (restaurantId: string, itemId: string): Promise<MenuItem> =>
    apiFetch(`${base(restaurantId)}/menu/items/${itemId}`),

  getUpsells: (restaurantId: string, itemId: string): Promise<{ suggestions: MenuItem[]; basedOn: string }> =>
    apiFetch(`${base(restaurantId)}/menu/items/${itemId}/suggestions`),

  initCart: (restaurantId: string, tableId: string, deviceId?: string): Promise<{ guestToken: string }> =>
    apiFetch(`${base(restaurantId)}/${tableId}/cart/init`, {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    }),

  getCart: (restaurantId: string, guestToken: string): Promise<Cart> =>
    apiFetch(`${base(restaurantId)}/cart?guestToken=${guestToken}`),

  addItem: (
    restaurantId: string,
    body: {
      guestToken: string
      itemId: string
      quantity: number
      modifiers?: { modifierId: string }[]
      notes?: string
    },
  ): Promise<Cart> =>
    apiFetch(`${base(restaurantId)}/cart`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (
    restaurantId: string,
    cartItemId: string,
    body: { guestToken: string; quantity: number },
  ): Promise<Cart> =>
    apiFetch(`${base(restaurantId)}/cart/${cartItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  removeItem: (restaurantId: string, cartItemId: string, guestToken: string): Promise<Cart> =>
    apiFetch(`${base(restaurantId)}/cart/${cartItemId}?guestToken=${guestToken}`, {
      method: 'DELETE',
    }),

  placeOrder: (
    restaurantId: string,
    body: {
      guestToken: string
      tableId: string
      guestCount?: number
      tipAmount?: number
      notes?: string
      paymentPreference?: 'pay_now' | 'pay_later'
    },
  ): Promise<PlacedOrder> =>
    apiFetch(`${base(restaurantId)}/place-order`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  trackOrder: (restaurantId: string, orderId: string, guestToken: string): Promise<OrderTracking> =>
    apiFetch(`${base(restaurantId)}/orders/${orderId}/status?guestToken=${guestToken}`),

  requestBill: (restaurantId: string, orderId: string, guestToken: string): Promise<{ message: string }> =>
    apiFetch(`${base(restaurantId)}/orders/${orderId}/request-bill`, {
      method: 'POST',
      body: JSON.stringify({ guestToken }),
    }),

  isStaffOnline: (restaurantId: string): Promise<{ available: boolean }> =>
    apiFetch(`${base(restaurantId)}/staff-online`),

  callWaiter: (restaurantId: string, guestToken: string, message?: string): Promise<{ message: string }> =>
    apiFetch(`${base(restaurantId)}/call-waiter`, {
      method: 'POST',
      body: JSON.stringify({ guestToken, message }),
    }),

  submitFeedback: (
    restaurantId: string,
    orderId: string,
    body: { guestToken: string; rating: number; comment?: string },
  ): Promise<{ message: string; reviewId: string }> =>
    apiFetch(`${base(restaurantId)}/orders/${orderId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getReceipt: (restaurantId: string, orderId: string, guestToken: string) =>
    apiFetch(`${base(restaurantId)}/orders/${orderId}/receipt?guestToken=${guestToken}`),

  getSessionSummary: (restaurantId: string, guestToken: string): Promise<SessionSummary> =>
    apiFetch(`${base(restaurantId)}/session/summary?guestToken=${guestToken}`),

  getTableCarts: (restaurantId: string, tableId: string): Promise<TableCart[]> =>
    apiFetch(`${base(restaurantId)}/${tableId}/carts`),

  identifyGuest: (restaurantId: string, body: { guestToken: string; firstName: string; phone?: string }) =>
    apiFetch(`${base(restaurantId)}/identify`, { method: 'POST', body: JSON.stringify(body) }),

  getMyOrder: (restaurantId: string, guestToken: string): Promise<{ orderId: string }> =>
    apiFetch(`${base(restaurantId)}/my-order?guestToken=${guestToken}`),
}
