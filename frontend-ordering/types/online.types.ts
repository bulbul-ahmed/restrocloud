// M13 — Online Ordering types
// Re-export shared menu types from qr.types
export type { MenuCategory, MenuItem, ModifierGroup, ModifierOption } from './qr.types'

export interface OnlineRestaurantSummary {
  id: string
  name: string
  publicSlug: string
  logoUrl?: string | null
  logoWordmarkUrl?: string | null
  city?: string | null
  deliveryFee?: string | null
  minimumOrderAmount?: string | null
  estimatedDeliveryMin?: number | null
  orderTypes: string[]
  isOpen?: boolean
}

export interface OnlineRestaurant {
  id: string
  name: string
  publicSlug: string
  description?: string | null
  logoUrl?: string | null
  logoWordmarkUrl?: string | null
  brandColor?: string | null
  city?: string | null
  currency: string
  taxRate: string
  taxInclusive: boolean
  serviceCharge: string
  tipOptions: number[]
  deliveryFee?: string | null
  minimumOrderAmount?: string | null
  deliveryRadiusKm?: number | null
  estimatedDeliveryMin?: number | null
  orderTypes: string[]
  isOpen?: boolean
}

export interface OnlineCartModifier {
  modifierId: string
  name: string
  priceAdjust: number
}

export interface OnlineCartItem {
  cartItemId: string
  itemId: string
  name: string
  quantity: number
  unitPrice: number
  modifiers: OnlineCartModifier[]
  notes?: string
  totalPrice: number
}

export interface OnlineCart {
  cartToken: string
  restaurantId: string
  items: OnlineCartItem[]
  itemCount: number
  subtotal: number
  taxEstimate: number
  serviceChargeEstimate: number
  totalEstimate: number
  currency: string
  updatedAt: string
}

export interface DeliveryAddress {
  line1: string
  line2?: string
  city: string
  area?: string
}

export interface PlacedOnlineOrderResponse {
  orderId: string
  orderNumber: string
  status: string
  channel: string
  totalAmount: number
  currency: string
  paymentMethod?: string | null
  estimatedDeliveryMin?: number | null
}

export interface OnlineOrderStatusHistory {
  status: string
  note?: string
  changedAt: string
}

export interface OnlineOrderTracking {
  orderId: string
  orderNumber: string
  status: string
  channel: string
  deliveryAddress?: DeliveryAddress | null
  items: { id: string; name: string; quantity: number; unitPrice: number; totalPrice: number; kitchenStatus: string }[]
  statusHistory: OnlineOrderStatusHistory[]
  subtotal: number
  taxAmount: number
  serviceCharge: number
  tipAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  estimatedDeliveryMin?: number | null
}

export interface OnlineCustomer {
  id: string
  firstName: string
  lastName?: string | null
  email: string
  phone?: string | null
}

export interface CustomerAuthResponse {
  accessToken: string
  customer: OnlineCustomer
}

export interface OrderHistoryItem {
  id: string
  orderNumber: string
  status: string
  channel: string
  orderType?: string
  totalAmount: number
  currency: string
  createdAt: string
  items: { name: string; quantity: number; unitPrice?: number }[]
}

export interface OrderReceiptItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface OrderReceipt {
  orderId: string
  orderNumber: string
  status: string
  channel: string
  items: OrderReceiptItem[]
  subtotal: number
  taxAmount: number
  serviceCharge: number
  tipAmount: number
  discountAmount: number
  totalAmount: number
  currency: string
  payments: { method: string; amount: number; status: string }[]
  deliveryAddress?: DeliveryAddress | null
  createdAt: string
}

export interface LoyaltyTransaction {
  id: string
  type: string
  points: number
  description?: string | null
  createdAt: string
}

export interface LoyaltyAccount {
  points: number
  tier: string
  totalEarned: number
  totalRedeemed: number
  nextTierThreshold: number | null
  transactions: LoyaltyTransaction[]
}

export interface SavedAddress {
  id: string
  label?: string | null
  line1: string
  line2?: string | null
  area?: string | null
  city: string
  isDefault: boolean
}

export interface SavedPaymentMethod {
  id: string
  gateway: string
  label?: string | null
  isDefault: boolean
}

export interface CustomerNotification {
  id: string
  title: string
  body?: string | null
  isRead: boolean
  createdAt: string
}

export interface Review {
  id: string
  rating: number
  comment?: string | null
  isApproved: boolean
  createdAt: string
  customer?: { firstName?: string | null } | null
}

export interface PaymentSession {
  type: 'COD' | 'GATEWAY'
  gateway?: string
  sessionId?: string
  checkoutSessionId?: string
  checkoutUrl?: string
  isMock?: boolean
  clientSecret?: string
  bkashURL?: string
  redirectUrl?: string
  sessionKey?: string
  payment?: { status: string; amount: number }
}

export type OnlineView = 'loading' | 'menu' | 'checkout' | 'payment' | 'tracking' | 'account' | 'error'
export type AuthModalMode = 'login' | 'register'
