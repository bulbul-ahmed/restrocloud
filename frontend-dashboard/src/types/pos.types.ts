export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE'
export type SessionStatus = 'OPEN' | 'BILL_REQUESTED' | 'CLOSED'
export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'ONLINE' | 'WALLET' | 'CREDIT'

// ── Floor plan / overview ─────────────────────────────────────────────────────

export interface POSTableSummary {
  id: string
  tableNumber: string
  capacity: number
  status: TableStatus
  floorSectionId: string
  sessions?: {
    id: string
    guestCount: number
    status: SessionStatus
    openedAt: string
    orders?: {
      id: string
      orderNumber: string
      totalAmount: string
      status: OrderStatus
      channel: string
    }[]
  }[]
}

export interface POSSection {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
  tables: POSTableSummary[]
}

export interface POSOverview {
  summary: {
    total: number
    available: number
    occupied: number
    reserved: number
    cleaning: number
    outOfService: number
  }
  sections: POSSection[]
}

// ── Current session (full detail) ─────────────────────────────────────────────

export interface OrderModifier {
  id: string
  modifierId: string
  name: string
  price: string
}

export interface OrderItem {
  id: string
  itemId: string | null
  name: string
  quantity: number
  unitPrice: string
  totalPrice: string
  notes?: string | null
  isVoid: boolean
  kitchenStatus: string
  modifiers: OrderModifier[]
}

export interface SessionOrder {
  id: string
  orderNumber: string
  channel: string
  status: OrderStatus
  subtotal: string
  taxAmount: string
  serviceCharge: string
  tipAmount: string
  discountAmount: string
  totalAmount: string
  currency: string
  createdAt: string
  items: OrderItem[]
}

export interface CurrentSession {
  id: string
  tableId: string
  guestCount: number
  status: SessionStatus
  openedAt: string
  notes?: string | null
  table: { id: string; tableNumber: string; capacity: number }
  orders: SessionOrder[]
}

// ── Cart (client-side) ────────────────────────────────────────────────────────

export interface CartModifier {
  modifierId: string
  name: string
  price: number
}

export interface CartItem {
  itemId: string
  name: string
  unitPrice: number
  quantity: number
  notes?: string
  modifiers: CartModifier[]
}
