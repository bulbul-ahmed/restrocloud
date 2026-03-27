export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export interface OrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  modifiers: Array<{ name: string; priceAdjustment: number }>
  notes?: string | null
  lineTotal: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  orderType: string
  items: OrderItem[]
  subtotal: number
  tax: number
  serviceCharge: number
  total: number
  notes?: string | null
  createdAt: string
  updatedAt: string
  estimatedReadyAt?: string | null
}

export interface OrderHistoryResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
}
