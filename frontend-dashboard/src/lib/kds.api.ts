import { api } from './api'
import type { KDSQueueEntry, KDSHistoryEntry, KDSStats } from '@/types/kds.types'

type Envelope<T> = { success: boolean; data: T }

export const kdsApi = {
  queue: (
    restaurantId: string,
    params?: { status?: string; channel?: string; categoryId?: string; limit?: number },
  ) =>
    api
      .get<Envelope<KDSQueueEntry[]>>(`/restaurants/${restaurantId}/kds/queue`, { params })
      .then((r) => r.data.data),

  history: (restaurantId: string, params?: { limit?: number }) =>
    api
      .get<Envelope<KDSHistoryEntry[]>>(`/restaurants/${restaurantId}/kds/history`, { params })
      .then((r) => r.data.data),

  stats: (restaurantId: string) =>
    api
      .get<Envelope<KDSStats>>(`/restaurants/${restaurantId}/kds/stats`)
      .then((r) => r.data.data),

  acknowledge: (restaurantId: string, orderId: string) =>
    api
      .patch<Envelope<{ acknowledged: number }>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/acknowledge`,
      )
      .then((r) => r.data.data),

  start: (restaurantId: string, orderId: string) =>
    api
      .patch<Envelope<{ started: number }>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/start`,
      )
      .then((r) => r.data.data),

  markItemReady: (restaurantId: string, orderId: string, itemId: string) =>
    api
      .patch<Envelope<unknown>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/items/${itemId}/ready`,
      )
      .then((r) => r.data.data),

  bumpReady: (restaurantId: string, orderId: string) =>
    api
      .patch<Envelope<{ bumped: number; orderNumber: string }>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/bump-ready`,
      )
      .then((r) => r.data.data),

  markItemServed: (restaurantId: string, orderId: string, itemId: string) =>
    api
      .patch<Envelope<unknown>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/items/${itemId}/served`,
      )
      .then((r) => r.data.data),

  bumpServed: (restaurantId: string, orderId: string) =>
    api
      .patch<Envelope<{ served: number; orderNumber: string }>>(
        `/restaurants/${restaurantId}/kds/orders/${orderId}/bump-served`,
      )
      .then((r) => r.data.data),
}
