// M13 — Online Ordering API calls
import { apiFetch } from './api'
import type {
  OnlineRestaurantSummary,
  OnlineRestaurant,
  OnlineCart,
  PlacedOnlineOrderResponse,
  OnlineOrderTracking,
  CustomerAuthResponse,
  OnlineCustomer,
  DeliveryAddress,
  OrderHistoryItem,
  OrderReceipt,
  LoyaltyAccount,
  SavedAddress,
  SavedPaymentMethod,
  CustomerNotification,
  Review,
  PaymentSession,
} from '../types/online.types'
import type { MenuCategory } from '../types/qr.types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

export class AuthExpiredError extends Error {
  constructor() { super('Session expired. Please log in again.') }
}

async function authFetch<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    if (res.status === 401) throw new AuthExpiredError()
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data as any)?.data ?? data
}

interface ListRestaurantsParams {
  city?: string
  search?: string
  page?: number
  limit?: number
}

interface ListRestaurantsResult {
  data: OnlineRestaurantSummary[]
  meta: { total: number; page: number; limit: number }
}

export async function listRestaurants(params: ListRestaurantsParams = {}): Promise<ListRestaurantsResult> {
  const qs = new URLSearchParams()
  if (params.city) qs.set('city', params.city)
  if (params.search) qs.set('search', params.search)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs}` : ''
  // listRestaurants returns { data: [], meta: {} } — apiFetch unwraps envelope so we get that inner object
  const result = await apiFetch<ListRestaurantsResult>(`/online/restaurants${query}`)
  return result
}

export async function getRestaurant(slug: string): Promise<OnlineRestaurant> {
  return apiFetch<OnlineRestaurant>(`/online/${slug}`)
}

export async function getMenu(slug: string): Promise<MenuCategory[]> {
  const result = await apiFetch<{ restaurant: unknown; categories: MenuCategory[] } | MenuCategory[]>(`/online/${slug}/menu`)
  // Backend returns { restaurant, categories } — extract the array
  if (result && !Array.isArray(result) && 'categories' in result) {
    return (result as { restaurant: unknown; categories: MenuCategory[] }).categories
  }
  return result as MenuCategory[]
}

export async function getItemDetail(slug: string, itemId: string): Promise<import('../types/qr.types').MenuItem> {
  return apiFetch<import('../types/qr.types').MenuItem>(`/online/${slug}/menu/items/${itemId}`)
}

export async function initCart(slug: string, restaurantId: string): Promise<OnlineCart> {
  return apiFetch<OnlineCart>(`/online/${slug}/cart/init?restaurantId=${restaurantId}`)
}

export async function getCart(slug: string, restaurantId: string, cartToken: string): Promise<OnlineCart> {
  return apiFetch<OnlineCart>(`/online/${slug}/cart?restaurantId=${restaurantId}&cartToken=${cartToken}`)
}

export async function addToCart(
  slug: string,
  restaurantId: string,
  body: { itemId: string; quantity: number; modifiers?: { modifierId: string }[]; notes?: string; cartToken: string },
): Promise<OnlineCart> {
  return apiFetch<OnlineCart>(`/online/${slug}/cart/items?restaurantId=${restaurantId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCartItem(
  slug: string,
  restaurantId: string,
  cartItemId: string,
  body: { quantity: number; cartToken: string },
): Promise<OnlineCart> {
  return apiFetch<OnlineCart>(`/online/${slug}/cart/${cartItemId}?restaurantId=${restaurantId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function removeCartItem(
  slug: string,
  restaurantId: string,
  cartItemId: string,
  cartToken: string,
): Promise<OnlineCart> {
  return apiFetch<OnlineCart>(
    `/online/${slug}/cart/${cartItemId}?restaurantId=${restaurantId}&cartToken=${cartToken}`,
    { method: 'DELETE' },
  )
}

interface PlaceOrderBody {
  cartToken: string
  orderType: string
  deliveryAddress?: DeliveryAddress
  notes?: string
  tipAmount?: number
  redeemPoints?: number
  guestName?: string
  guestPhone?: string
}

export async function placeOrder(
  slug: string,
  token: string | null,
  body: PlaceOrderBody,
): Promise<PlacedOnlineOrderResponse> {
  return authFetch<PlacedOnlineOrderResponse>(`/online/${slug}/orders`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function trackOrder(slug: string, orderId: string, cartToken?: string | null, token?: string | null): Promise<OnlineOrderTracking> {
  const qs = new URLSearchParams()
  if (cartToken) qs.set('cartToken', cartToken)
  const query = qs.toString() ? `?${qs}` : ''
  return authFetch<OnlineOrderTracking>(`/online/${slug}/orders/${orderId}${query}`, token ?? null)
}

export async function register(slug: string, body: { firstName: string; lastName?: string; email: string; phone?: string; password: string }): Promise<CustomerAuthResponse> {
  return apiFetch<CustomerAuthResponse>(`/online/${slug}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function login(slug: string, body: { email: string; password: string }): Promise<CustomerAuthResponse> {
  return apiFetch<CustomerAuthResponse>(`/online/${slug}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getMe(slug: string, token: string): Promise<OnlineCustomer> {
  return authFetch<OnlineCustomer>(`/online/${slug}/auth/me`, token)
}

export async function updateMe(slug: string, token: string, body: Partial<{ firstName: string; lastName: string; phone: string; email: string; currentPassword: string; password: string }>): Promise<OnlineCustomer> {
  return authFetch<OnlineCustomer>(`/online/${slug}/auth/me`, token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function getReviews(slug: string): Promise<Review[]> {
  return apiFetch<Review[]>(`/online/${slug}/reviews`)
}

export async function submitReview(slug: string, token: string, body: { rating: number; comment?: string }): Promise<Review> {
  return authFetch<Review>(`/online/${slug}/reviews`, token, { method: 'POST', body: JSON.stringify(body) })
}

// ─── Account — Orders ─────────────────────────────────────────────────────────

export async function getMyOrders(slug: string, token: string, page = 1): Promise<{ orders: OrderHistoryItem[]; meta: { total: number; page: number; limit: number } }> {
  return authFetch(`/online/${slug}/my/orders?page=${page}&limit=10`, token)
}

export async function getOrderReceipt(slug: string, token: string, orderId: string): Promise<OrderReceipt> {
  return authFetch(`/online/${slug}/my/orders/${orderId}/receipt`, token)
}

export async function reorder(slug: string, token: string, orderId: string): Promise<{ cartToken: string }> {
  return authFetch(`/online/${slug}/my/reorder/${orderId}`, token, { method: 'POST' })
}

// ─── Account — Loyalty ────────────────────────────────────────────────────────

export async function getMyLoyalty(slug: string, token: string): Promise<LoyaltyAccount> {
  return authFetch(`/online/${slug}/my/loyalty`, token)
}

// ─── Account — Addresses ──────────────────────────────────────────────────────

export async function getMyAddresses(slug: string, token: string): Promise<SavedAddress[]> {
  return authFetch(`/online/${slug}/my/addresses`, token)
}

export async function createAddress(slug: string, token: string, body: Omit<SavedAddress, 'id' | 'isDefault'>): Promise<SavedAddress> {
  return authFetch(`/online/${slug}/my/addresses`, token, { method: 'POST', body: JSON.stringify(body) })
}

export async function deleteAddress(slug: string, token: string, id: string): Promise<void> {
  await authFetch(`/online/${slug}/my/addresses/${id}`, token, { method: 'DELETE' })
}

export async function setDefaultAddress(slug: string, token: string, id: string): Promise<SavedAddress> {
  return authFetch(`/online/${slug}/my/addresses/${id}/default`, token, { method: 'PATCH' })
}

// ─── Account — Payment Methods ────────────────────────────────────────────────

export async function getMyPaymentMethods(slug: string, token: string): Promise<SavedPaymentMethod[]> {
  return authFetch(`/online/${slug}/my/payment-methods`, token)
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getMyNotifications(slug: string, token: string): Promise<{ total: number; unread: number; notifications: CustomerNotification[] }> {
  return authFetch(`/online/${slug}/my/notifications`, token)
}

export async function markNotificationRead(slug: string, token: string, id: string): Promise<void> {
  await authFetch(`/online/${slug}/my/notifications/${id}/read`, token, { method: 'PATCH' })
}

export async function markAllNotificationsRead(slug: string, token: string): Promise<void> {
  await authFetch(`/online/${slug}/my/notifications/read-all`, token, { method: 'PATCH' })
}

// ─── Payment Methods (public) ─────────────────────────────────────────────────

export async function getPaymentMethods(slug: string): Promise<{ methods: { id: string; label: string }[] }> {
  return apiFetch(`/online/${slug}/payment-methods`)
}

// ─── Payment Gateway ──────────────────────────────────────────────────────────

export async function initiatePayment(slug: string, token: string | null, orderId: string, body: { gateway: string; cartToken?: string }): Promise<PaymentSession> {
  // Backend DTO expects { method: 'STRIPE' } (uppercase enum) — map from lowercase gateway id
  const payload = { method: body.gateway.toUpperCase(), cartToken: body.cartToken }
  // Backend returns { type, payment, session: {...gatewayData} } — extract the inner session
  const result = await authFetch<any>(`/online/${slug}/orders/${orderId}/pay`, token, { method: 'POST', body: JSON.stringify(payload) })
  return result?.session ?? result
}

export async function confirmStripePayment(
  slug: string,
  token: string | null,
  orderId: string,
  sessionId: string,
  cartToken?: string,
): Promise<{ status: string; alreadyProcessed: boolean }> {
  return authFetch(
    `/online/${slug}/orders/${orderId}/payment/stripe-confirm`,
    token,
    { method: 'POST', body: JSON.stringify({ sessionId, cartToken }) },
  )
}
