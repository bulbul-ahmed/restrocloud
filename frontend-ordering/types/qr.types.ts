// M12 — QR Table Ordering types

export interface QrRestaurant {
  id: string
  name: string
  logoUrl?: string | null
  logoWordmarkUrl?: string | null
  brandColor?: string | null
  currency: string
  taxRate: number
  taxInclusive: boolean
  serviceCharge: number
  tipOptions: number[]
}

export interface QrTable {
  id: string
  tableNumber: string
  capacity: number
  status: string
  floorSection?: { id: string; name: string } | null
}

export interface QrContext {
  restaurant: QrRestaurant
  table: QrTable
  activeSession?: { id: string; status: string } | null
}

export interface ModifierOption {
  id: string
  name: string
  priceAdjustment: number
  isAvailable: boolean
  isRequired: boolean
  childGroups?: ModifierGroup[]  // nested sub-options (up to 3 levels deep)
}

export interface ModifierGroup {
  id: string
  name: string
  minSelections: number
  maxSelections: number
  isRequired: boolean
  modifiers: ModifierOption[]
}

export interface MenuItem {
  id: string
  name: string
  description?: string | null
  price: string | number
  imageUrl?: string | null
  isAvailable: boolean
  allergens?: string[]
  dietaryTags?: string[]
  modifierGroups?: ModifierGroup[]
}

export interface MenuCategory {
  id: string
  name: string
  displayOrder: number
  items: MenuItem[]
}

export interface CartModifier {
  modifierId: string
  name: string
  priceAdjust: number
}

export interface CartItem {
  cartItemId: string
  itemId: string
  name: string
  quantity: number
  unitPrice: number
  modifiers: CartModifier[]
  notes?: string
  totalPrice: number
}

export interface Cart {
  guestToken: string
  tableId: string
  restaurantId: string
  items: CartItem[]
  itemCount: number
  subtotal: number
  taxEstimate: number
  serviceChargeEstimate: number
  totalEstimate: number
  currency: string
  updatedAt: string
}

export interface PlacedOrder {
  orderId: string
  orderNumber: string
  status: string
  channel: string
  tableNumber: string | null
  totalAmount: number
  currency: string
  paymentPreference: string
  payNowUrl: string | null
}

export interface OrderTracking {
  orderId: string
  orderNumber: string
  status: string
  tableNumber: string | null
  acceptedAt?: string | null
  readyAt?: string | null
  estimatedReadyAt?: string | null
  subtotal: number
  taxAmount: number
  serviceChargeAmount: number
  tipAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  items: { id: string; name: string; quantity: number; unitPrice: number; totalPrice: number; kitchenStatus: string }[]
  statusHistory: { status: string; note?: string; changedAt: string }[]
}

export type QrView = 'loading' | 'menu' | 'checkout' | 'tracking' | 'occupied' | 'session_ended'

export interface SessionRoundItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface SessionRound {
  round: number
  orderId: string
  orderNumber: string
  status: string
  guestName?: string | null
  placedAt: string
  subtotal: number
  totalAmount: number
  items: SessionRoundItem[]
}

export interface TableCartItem {
  cartItemId: string
  name: string
  quantity: number
  totalPrice: number
  modifiers: { modifierId: string; name: string }[]
}

export interface TableCart {
  guestToken: string
  guestName: string | null
  itemCount: number
  subtotalEstimate: number
  items: TableCartItem[]
}

export interface SessionSummary {
  orderCount: number
  sessionTotal: number
  orders: SessionRound[]
}
