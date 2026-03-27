'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { User } from 'lucide-react'
import { BellIcon, CartIcon } from '../icons'
import { toast } from 'sonner'
import type { OnlineRestaurant, OnlineView, AuthModalMode, PaymentSession } from '../../types/online.types'
import type { MenuCategory, MenuItem } from '../../types/qr.types'
import { useOnlineCart } from '../../store/online-cart.store'
import { useOnlineCustomer } from '../../store/online-customer.store'
import * as onlineApi from '../../lib/online.api'
import { applyBrandColor } from '../../lib/theme'

import RestaurantHero from './RestaurantHero'
import MenuView from './MenuView'
import CartDrawer from './CartDrawer'
import CheckoutView from './CheckoutView'
import AuthModal from './AuthModal'
import OrderTracker from './OrderTracker'
import AccountView from './AccountView'
import ReviewsSection from './ReviewsSection'
import NotificationsDrawer from './NotificationsDrawer'
import PaymentView from './PaymentView'
import { ItemSheet } from './ItemSheet'
import { Spinner } from '../qr/Spinner'

interface Props {
  slug: string
  initialRestaurant: OnlineRestaurant
}

export default function OnlineShell({ slug, initialRestaurant }: Props) {
  const restaurant = initialRestaurant

  // Apply restaurant brand color on mount
  useEffect(() => { applyBrandColor(restaurant.brandColor) }, [restaurant.brandColor])

  // Stores
  const {
    cart, cartToken, orderId,
    setCart, setOrderId, clearCart, loadPersistedTokens, itemCount,
  } = useOnlineCart()
  const { token, customer, setAuth, clearAuth, loadAuth } = useOnlineCustomer()

  // View state
  const [view, setView] = useState<OnlineView>('loading')
  const [categories, setCategories] = useState<MenuCategory[]>([])

  // Overlay state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthModalMode>('login')
  const [notifOpen, setNotifOpen] = useState(false)

  // Menu state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Payment state (FO-11)
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: string; orderNumber: string; gateway: string; session: PaymentSession; totalAmount: number
  } | null>(null)

  // Notification badge (FO-14)
  const [unreadCount, setUnreadCount] = useState(0)

  // Scroll shrink hero
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // IntersectionObserver for active category sync
  useEffect(() => {
    if (view !== 'menu' || categories.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) setActiveCategory(visible.target.id.replace('cat-', ''))
      },
      { rootMargin: '-20% 0px -70% 0px' },
    )
    categories.forEach((cat) => {
      const el = categoryRefs.current[cat.id]
      if (el) { el.id = `cat-${cat.id}`; observer.observe(el) }
    })
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, categories])

  // Poll for new notifications every 30s while logged in
  useEffect(() => {
    if (!token) { setUnreadCount(0); return }

    let prev = -1

    const poll = async () => {
      try {
        const res = await onlineApi.getMyNotifications(slug, token)
        const count = (res as any)?.unread ?? 0
        setUnreadCount(count)
        // Toast for new notifications after the first fetch
        if (prev >= 0 && count > prev) {
          const notifs: import('../../types/online.types').CustomerNotification[] =
            (res as any)?.notifications ?? []
          const newest = notifs.find(n => !n.isRead)
          toast(newest?.title ?? 'New notification', {
            description: newest?.body,
            duration: 5000,
          })
        }
        prev = count
      } catch { /* silent — token may have expired */ }
    }

    poll() // immediate on login
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [token, slug])

  // Init sequence
  useEffect(() => {
    let cancelled = false

    async function init() {
      loadAuth(slug)
      loadPersistedTokens(slug)

      // ── Stripe return detection ───────────────────────────────────────────
      const params = new URLSearchParams(window.location.search)
      const stripeSuccess = params.get('stripe_success')
      const stripeCancel = params.get('stripe_cancel')
      const stripeSessionId = params.get('session_id')
      const stripeOrderId = params.get('orderId')
      const stripeCartToken = params.get('cartToken') || undefined

      if (stripeSuccess && stripeSessionId && stripeOrderId) {
        // Clean URL immediately
        window.history.replaceState({}, '', `/${slug}`)
        // Fetch menu in background while confirming
        try { const cats = await onlineApi.getMenu(slug); if (!cancelled) { setCategories(cats) } } catch {}
        // Confirm payment with backend
        try {
          await onlineApi.confirmStripePayment(slug, null, stripeOrderId, stripeSessionId, stripeCartToken)
          if (!cancelled) toast.success('Payment confirmed!')
        } catch {
          if (!cancelled) toast.error('Payment confirmation failed. Please contact the restaurant.')
        }
        if (!cancelled) {
          setOrderId(slug, stripeOrderId)
          setView('tracking')
        }
        return
      }

      if (stripeCancel && stripeOrderId) {
        window.history.replaceState({}, '', `/${slug}`)
        try { const cats = await onlineApi.getMenu(slug); if (!cancelled) { setCategories(cats) } } catch {}
        if (!cancelled) {
          setOrderId(slug, stripeOrderId)
          setView('tracking')
          toast.error('Payment was cancelled. Your order is still pending payment.')
        }
        return
      }
      // ─────────────────────────────────────────────────────────────────────

      // Always fetch menu
      try {
        const cats = await onlineApi.getMenu(slug)
        if (!cancelled) {
          setCategories(cats)
          if (cats.length > 0) setActiveCategory(cats[0].id)
        }
      } catch {
        if (!cancelled) setView('error')
        return
      }

      if (cancelled) return

      // Check persisted orderId — only show tracking if order is still active
      const persistedOrderId = localStorage.getItem(`online_order_id_${slug}`)
      if (persistedOrderId) {
        const persistedCartToken = localStorage.getItem(`online_cart_token_${slug}`)
        try {
          const tracked = await onlineApi.trackOrder(slug, persistedOrderId, persistedCartToken, token)
          const TERMINAL = ['COMPLETED', 'SERVED', 'CANCELLED', 'REFUNDED']
          if (TERMINAL.includes(tracked.status)) {
            // Order is done — clear it and fall through to menu
            localStorage.removeItem(`online_order_id_${slug}`)
          } else {
            if (!cancelled) setView('tracking')
            return
          }
        } catch {
          // Order not found or access denied — clear stale id and fall through
          localStorage.removeItem(`online_order_id_${slug}`)
        }
      }

      // Check persisted cartToken
      const persistedCartToken = localStorage.getItem(`online_cart_token_${slug}`)
      if (persistedCartToken) {
        try {
          const existingCart = await onlineApi.getCart(slug, restaurant.id, persistedCartToken)
          if (!cancelled) {
            setCart(slug, existingCart)
            setView('menu')
          }
          return
        } catch {
          // Cart expired — init new
        }
      }

      // Init new cart
      try {
        const newCart = await onlineApi.initCart(slug, restaurant.id)
        if (!cancelled) {
          setCart(slug, newCart)
          setView('menu')
        }
      } catch {
        if (!cancelled) setView('error')
      }
    }

    init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const initNewCart = useCallback(async () => {
    const newCart = await onlineApi.initCart(slug, restaurant.id)
    setCart(slug, newCart)
  }, [slug, restaurant.id, setCart])

  // Cart handlers
  const handleAddItem = async (itemId: string, quantity: number, modifiers: { modifierId: string }[], notes: string) => {
    if (!cartToken) return
    try {
      const updated = await onlineApi.addToCart(slug, restaurant.id, { itemId, quantity, modifiers, notes: notes || undefined, cartToken })
      setCart(slug, updated)
      toast.success('Added to cart')
      setSelectedItem(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add item')
    }
  }

  const handleUpdateItem = async (cartItemId: string, quantity: number) => {
    if (!cartToken) return
    try {
      const updated = await onlineApi.updateCartItem(slug, restaurant.id, cartItemId, { quantity, cartToken })
      setCart(slug, updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  const handleRemoveItem = async (cartItemId: string) => {
    if (!cartToken) return
    try {
      const updated = await onlineApi.removeCartItem(slug, restaurant.id, cartItemId, cartToken)
      setCart(slug, updated)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove item')
    }
  }

  const handlePlaceOrder = async (params: {
    orderType: string
    deliveryAddress?: object
    notes?: string
    tip?: number
    redeemPoints?: number
    paymentGateway: string
    guestName?: string
    guestPhone?: string
  }) => {
    if (!cartToken) return
    try {
      const placed = await onlineApi.placeOrder(slug, token, {
        cartToken,
        orderType: params.orderType,
        deliveryAddress: params.deliveryAddress as any,
        notes: params.notes,
        tipAmount: params.tip,
        redeemPoints: params.redeemPoints,
        guestName: params.guestName,
        guestPhone: params.guestPhone,
      })
      setOrderId(slug, placed.orderId)

      if (params.paymentGateway === 'cod') {
        // Initiate COD payment (auto-completes server-side)
        try {
          await onlineApi.initiatePayment(slug, token, placed.orderId, { gateway: 'cod' })
        } catch { /* order already placed, ignore payment initiation error */ }
        setView('tracking')
        toast.success('Order placed!')
      } else {
        // Initiate gateway payment → show PaymentView
        try {
          const session = await onlineApi.initiatePayment(slug, token, placed.orderId, { gateway: params.paymentGateway, cartToken: cartToken ?? undefined })
          setPendingPayment({
            orderId: placed.orderId,
            orderNumber: placed.orderNumber,
            gateway: params.paymentGateway,
            session,
            totalAmount: placed.totalAmount,
          })
          setView('payment')
        } catch {
          // Gateway initiation failed — fall through to tracking
          setView('tracking')
          toast.success('Order placed!')
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to place order')
      throw err
    }
  }

  const handleOrderAgain = async () => {
    clearCart(slug)
    try {
      const newCart = await onlineApi.initCart(slug, restaurant.id)
      setCart(slug, newCart)
    } catch { /* silent */ }
    setView('menu')
  }

  // Reorder from account history (FO-5)
  const handleReorder = async (cartToken: string) => {
    try {
      const freshCart = await onlineApi.getCart(slug, restaurant.id, cartToken)
      setCart(slug, freshCart)
      setView('menu')
      toast.success('Items added to cart!')
    } catch {
      setView('menu')
    }
  }

  const handleAuthSuccess = (newToken: string, newCustomer: import('../../types/online.types').OnlineCustomer) => {
    setAuth(slug, newToken, newCustomer)
    setAuthOpen(false)
    toast.success(`Welcome, ${newCustomer.firstName}!`)
  }

  const handleCustomerUpdate = (updated: import('../../types/online.types').OnlineCustomer) => {
    if (!token) return
    setAuth(slug, token, updated)
  }

  // ─── View renders ───────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    )
  }

  if (view === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-500 mb-4">Unable to load restaurant</p>
        <button onClick={() => window.location.reload()} className="text-brand underline text-sm">Retry</button>
      </div>
    )
  }

  if (view === 'account' && customer && token) {
    return (
      <AccountView
        slug={slug}
        token={token}
        customer={customer}
        restaurantId={restaurant.id}
        onBack={() => setView('menu')}
        onCustomerUpdate={handleCustomerUpdate}
        onReorder={handleReorder}
        onSessionExpired={() => {
          clearAuth(slug)
          setView('menu')
          toast.error('Session expired. Please log in again.')
          setAuthMode('login')
          setAuthOpen(true)
        }}
      />
    )
  }

  if (view === 'payment' && pendingPayment) {
    return (
      <PaymentView
        slug={slug}
        orderId={pendingPayment.orderId}
        orderNumber={pendingPayment.orderNumber}
        gateway={pendingPayment.gateway}
        session={pendingPayment.session}
        totalAmount={pendingPayment.totalAmount}
        restaurant={restaurant}
        onComplete={() => {
          setPendingPayment(null)
          setView('tracking')
          toast.success('Payment confirmed!')
        }}
        onBack={() => setView('tracking')}
      />
    )
  }

  if (view === 'tracking' && orderId) {
    return (
      <>
        <OrderTracker
          slug={slug}
          orderId={orderId}
          cartToken={cartToken}
          token={token}
          restaurant={restaurant}
          onOrderAgain={handleOrderAgain}
        />
        {authOpen && (
          <AuthModal
            mode={authMode}
            slug={slug}
            onClose={() => setAuthOpen(false)}
            onSuccess={handleAuthSuccess}
            onModeChange={setAuthMode}
          />
        )}
      </>
    )
  }

  if (view === 'checkout' && cart) {
    return (
      <>
        <CheckoutView
          cart={cart}
          restaurant={restaurant}
          slug={slug}
          token={token}
          customerName={customer?.firstName}
          onBack={() => setView('menu')}
          onAuthRequired={(mode) => { setAuthMode(mode); setAuthOpen(true) }}
          onPlaceOrder={handlePlaceOrder}
        />
        {authOpen && (
          <AuthModal
            mode={authMode}
            slug={slug}
            onClose={() => setAuthOpen(false)}
            onSuccess={handleAuthSuccess}
            onModeChange={setAuthMode}
          />
        )}
      </>
    )
  }

  // ─── Menu view (default) ────────────────────────────────────────────────────
  const count = itemCount()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header (shrinks on scroll) */}
      <div className="sticky top-0 z-30 bg-white shadow-sm transition-all">
        {scrolled ? (
          <div className="flex items-center justify-between pr-2">
            <RestaurantHero restaurant={restaurant} minimal />
            <div className="flex items-center gap-1 pr-2">
              {token && (
                <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded-full hover:bg-gray-100">
                  <BellIcon size={24} className="text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-brand text-white text-[10px] flex items-center justify-center rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button onClick={() => setCartOpen(true)} className="relative p-2 rounded-full hover:bg-gray-100">
                <CartIcon size={24} className="text-gray-600" />
                {count > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-brand text-white text-[10px] flex items-center justify-center rounded-full">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
              {customer ? (
                <button
                  onClick={() => setView('account')}
                  className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold"
                >
                  {customer.firstName.charAt(0).toUpperCase()}
                </button>
              ) : (
                <button onClick={() => { setAuthMode('login'); setAuthOpen(true) }} className="p-2 rounded-full hover:bg-gray-100">
                  <User size={18} className="text-gray-600" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-xs text-gray-500">
                {customer ? `Hi, ${customer.firstName} 👋` : ''}
              </span>
              <div className="flex items-center gap-2">
                {token && (
                  <button onClick={() => setNotifOpen(true)} className="relative p-1.5 rounded-full hover:bg-gray-100">
                    <BellIcon size={24} className="text-gray-500" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand text-white text-[9px] flex items-center justify-center rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={() => setCartOpen(true)} className="relative p-1.5 rounded-full hover:bg-gray-100">
                  <CartIcon size={24} className="text-gray-500" />
                  {count > 0 && (
                    <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-brand text-white text-[9px] flex items-center justify-center rounded-full">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </button>
                {customer ? (
                  <button
                    onClick={() => setView('account')}
                    className="flex items-center gap-1.5 text-xs text-brand font-medium"
                  >
                    <div className="h-5 w-5 rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold">
                      {customer.firstName.charAt(0).toUpperCase()}
                    </div>
                    My Account
                  </button>
                ) : (
                  <button onClick={() => { setAuthMode('login'); setAuthOpen(true) }} className="flex items-center gap-1 text-xs text-brand font-medium">
                    <User size={14} /> Sign in
                  </button>
                )}
              </div>
            </div>
            <RestaurantHero restaurant={restaurant} />
          </div>
        )}
      </div>

      {/* Menu */}
      <MenuView
        categories={categories}
        currency={restaurant.currency}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onItemSelect={(item) => setSelectedItem(item)}
        categoryRefs={categoryRefs}
      />

      {/* Reviews section (FO-8, FO-9) */}
      {categories.length > 0 && (
        <ReviewsSection
          slug={slug}
          token={token}
          isLoggedIn={!!token}
          onLoginRequired={() => { setAuthMode('login'); setAuthOpen(true) }}
        />
      )}


      {/* Item side sheet */}
      {selectedItem && (
        <ItemSheet
          item={selectedItem}
          currency={restaurant.currency}
          onClose={() => setSelectedItem(null)}
          onAdd={handleAddItem}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && cart && (
        <CartDrawer
          cart={cart}
          restaurant={restaurant}
          onClose={() => setCartOpen(false)}
          onUpdate={handleUpdateItem}
          onRemove={handleRemoveItem}
          onProceedToCheckout={() => setView('checkout')}
        />
      )}

      {/* Auth modal */}
      {authOpen && (
        <AuthModal
          mode={authMode}
          slug={slug}
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
          onModeChange={setAuthMode}
        />
      )}

      {/* Notifications drawer (FO-14) */}
      {notifOpen && token && (
        <NotificationsDrawer
          slug={slug}
          token={token}
          onClose={() => setNotifOpen(false)}
          onUnreadChange={setUnreadCount}
        />
      )}
    </div>
  )
}
