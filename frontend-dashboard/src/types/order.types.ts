export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type OrderChannel =
  | 'DINE_IN'
  | 'TAKEAWAY'
  | 'DELIVERY'
  | 'QR'
  | 'ONLINE'
  | 'KIOSK'
  | 'AGGREGATOR'

export interface OrderModifier {
  id: string
  modifierId: string
  name: string
  priceAdjust: string
}

export interface OrderItem {
  id: string
  itemId: string | null
  name: string
  quantity: number
  unitPrice: string
  totalPrice: string
  notes: string | null
  isVoid: boolean
  kitchenStatus: string
  modifiers: OrderModifier[]
}

export interface OrderStatusHistory {
  id: string
  status: OrderStatus
  note: string | null
  changedAt: string
  changedBy: string | null
}

export interface OrderCustomer {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
}

export interface Order {
  id: string
  orderNumber: string
  channel: OrderChannel
  status: OrderStatus
  tableId: string | null
  tableSessionId: string | null
  customerId: string | null
  notes: string | null
  guestName: string | null
  guestPhone: string | null
  subtotal: string
  taxAmount: string
  serviceCharge: string
  tipAmount: string
  discountAmount: string
  totalAmount: string
  currency: string
  cancelReason: string | null
  aggregatorName: string | null
  externalOrderId: string | null
  acceptedAt: string | null
  readyAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  table: { id: string; tableNumber: string } | null
  createdBy: { id: string; firstName: string; lastName: string } | null
  customer: OrderCustomer | null
  items: OrderItem[]
  statusHistory?: OrderStatusHistory[]
}

export interface OrderListResponse {
  orders: Order[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
