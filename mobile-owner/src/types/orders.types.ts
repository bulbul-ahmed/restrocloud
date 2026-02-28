export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'

export type OrderChannel = 'POS' | 'QR' | 'ONLINE' | 'AGGREGATOR' | 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'

export interface OrderItem {
  id: string
  name: string
  quantity: number
  unitPrice: string
  totalPrice: string
  notes?: string | null
  modifiers?: { name: string; price: string }[]
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  channel: OrderChannel
  totalAmount: string
  subtotal: string
  taxAmount: string
  serviceCharge: string
  tipAmount: string
  discountAmount: string
  notes?: string | null
  createdAt: string
  updatedAt: string
  tableId?: string | null
  guestName?: string | null
  items: OrderItem[]
}

export interface OrdersResponse {
  orders: Order[]
  total: number
  page: number
  limit: number
}
