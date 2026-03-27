import { api } from './api'
import type { Payment, PaymentListResponse, PaymentSummary, ListPaymentsParams } from '@/types/payment.types'

type Env<T> = { data: T }

export const paymentsApi = {
  list: (restaurantId: string, params?: ListPaymentsParams) =>
    api
      .get<Env<PaymentListResponse>>(`/restaurants/${restaurantId}/payments`, { params })
      .then((r) => r.data.data),

  get: (restaurantId: string, paymentId: string) =>
    api
      .get<Env<Payment>>(`/restaurants/${restaurantId}/payments/${paymentId}`)
      .then((r) => r.data.data),

  summary: (restaurantId: string, params?: { dateFrom?: string; dateTo?: string }) =>
    api
      .get<Env<PaymentSummary>>(`/restaurants/${restaurantId}/payments/summary`, { params })
      .then((r) => r.data.data),

  refund: (restaurantId: string, paymentId: string, body: { amount: number; reason?: string }) =>
    api
      .post<Env<unknown>>(`/restaurants/${restaurantId}/payments/${paymentId}/refund`, body)
      .then((r) => r.data.data),

  approveRefund: (restaurantId: string, paymentId: string, refundId: string) =>
    api
      .patch<Env<unknown>>(`/restaurants/${restaurantId}/payments/${paymentId}/refunds/${refundId}/approve`)
      .then((r) => r.data.data),
}
