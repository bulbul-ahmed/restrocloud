import { api } from './api'
import type { Order, OrderListResponse } from '@/types/order.types'

type Envelope<T> = { success: boolean; data: T }

export interface OrderListParams {
  status?: string
  channel?: string
  source?: 'pos' | 'qr' | 'online'
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export const ordersApi = {
  list: (restaurantId: string, params?: OrderListParams) =>
    api
      .get<Envelope<OrderListResponse>>(`/restaurants/${restaurantId}/orders`, { params })
      .then((r) => r.data.data),

  get: (restaurantId: string, orderId: string) =>
    api
      .get<Envelope<Order>>(`/restaurants/${restaurantId}/orders/${orderId}`)
      .then((r) => r.data.data),

  accept: (restaurantId: string, orderId: string) =>
    api
      .patch<Envelope<Order>>(`/restaurants/${restaurantId}/orders/${orderId}/accept`)
      .then((r) => r.data.data),

  reject: (restaurantId: string, orderId: string, reason?: string) =>
    api
      .patch<Envelope<Order>>(`/restaurants/${restaurantId}/orders/${orderId}/reject`, { reason })
      .then((r) => r.data.data),

  cancel: (restaurantId: string, orderId: string, reason?: string) =>
    api
      .patch<Envelope<Order>>(`/restaurants/${restaurantId}/orders/${orderId}/cancel`, { reason })
      .then((r) => r.data.data),

  updateStatus: (restaurantId: string, orderId: string, status: string, note?: string) =>
    api
      .patch<Envelope<Order>>(`/restaurants/${restaurantId}/orders/${orderId}/status`, {
        status,
        note,
      })
      .then((r) => r.data.data),
}
