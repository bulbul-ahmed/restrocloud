import { apiFetch } from './api'
import type { Order, OrdersResponse, OrderStatus } from '../types/orders.types'

export const ordersApi = {
  list: (
    rid: string,
    params: { status?: OrderStatus; page?: number; limit?: number } = {},
  ): Promise<OrdersResponse> => {
    const q = new URLSearchParams()
    if (params.status) q.set('status', params.status)
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    return apiFetch(`/restaurants/${rid}/orders?${q.toString()}`)
  },

  get: (rid: string, orderId: string): Promise<Order> =>
    apiFetch(`/restaurants/${rid}/orders/${orderId}`),

  accept: (rid: string, orderId: string): Promise<Order> =>
    apiFetch(`/restaurants/${rid}/orders/${orderId}/accept`, { method: 'PATCH' }),

  reject: (rid: string, orderId: string, reason?: string): Promise<Order> =>
    apiFetch(`/restaurants/${rid}/orders/${orderId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
}
