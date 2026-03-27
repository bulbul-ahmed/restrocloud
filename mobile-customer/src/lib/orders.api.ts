import { apiFetch, slugPath } from './api'
import type { Order, OrderHistoryResponse } from '../types/order.types'

export const ordersApi = {
  placeOrder: (data: {
    restaurantId: string
    cartToken: string
    orderType: string
    deliveryAddressId?: string
    notes?: string
    paymentMethod: string
  }): Promise<Order> =>
    apiFetch(slugPath('/orders'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOrder: (orderId: string, cartToken?: string): Promise<Order> => {
    const qs = cartToken ? `?cartToken=${cartToken}` : ''
    return apiFetch(slugPath(`/orders/${orderId}${qs}`))
  },

  getHistory: (page = 1, limit = 20): Promise<OrderHistoryResponse> =>
    apiFetch(slugPath(`/my/orders?page=${page}&limit=${limit}`)),

  getReceipt: (orderId: string): Promise<Order> =>
    apiFetch(slugPath(`/my/orders/${orderId}/receipt`)),

  reorder: (orderId: string): Promise<{ cartToken: string }> =>
    apiFetch(slugPath(`/my/reorder/${orderId}`), { method: 'POST' }),
}
