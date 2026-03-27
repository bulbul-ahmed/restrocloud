export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'ONLINE' | 'WALLET' | 'CREDIT'
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

export interface Refund {
  id: string
  paymentId: string
  amount: string
  reason: string | null
  status: RefundStatus
  gatewayRefId: string | null
  processedAt: string | null
  createdAt: string
}

export interface Payment {
  id: string
  orderId: string
  restaurantId: string
  tenantId: string
  method: PaymentMethod
  amount: string
  currency: string
  status: PaymentStatus
  gatewayName: string | null
  gatewayTxId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  refunds: Refund[]
  order?: {
    orderNumber: string
    totalAmount: string
    status: string
  }
  transactions?: Array<{
    id: string
    type: string
    amount: string
    createdAt: string
  }>
}

export interface PaymentListResponse {
  payments: Payment[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface PaymentMethodSummary {
  method: PaymentMethod
  count: number
  gross: number
  refunded: number
  net: number
}

export interface PaymentSummary {
  totalGross: number
  totalRefunded: number
  totalNet: number
  totalTransactions: number
  byMethod: PaymentMethodSummary[]
}

export interface ListPaymentsParams {
  status?: PaymentStatus
  method?: PaymentMethod
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}
