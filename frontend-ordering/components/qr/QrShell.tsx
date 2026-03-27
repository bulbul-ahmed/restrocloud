'use client'
import { useEffect, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import { CartIcon } from '../icons'
import { cn } from '../../lib/utils'
import { applyBrandColor } from '../../lib/theme'
import { qrApi } from '../../lib/qr.api'
import { useQrCart } from '../../store/qr-cart.store'
import type { MenuCategory, MenuItem, QrContext, TableCart } from '../../types/qr.types'
import { ItemCard } from './ItemCard'
import { ItemSheet } from '../online/ItemSheet'
import { CheckoutPage } from './CheckoutPage'
import { CartDrawer } from './CartDrawer'
import { OrderTracker } from './OrderTracker'
import { UpsellModal } from './UpsellModal'
import { Spinner } from './Spinner'
import { JoinScreen } from './JoinScreen'

function getOrCreateDeviceId(): string {
  try {
    const key = 'qr_device_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return '' // SSR / private browsing fallback
  }
}

function ThankYouScreen({ restaurant, table, secondsLeft }: { restaurant: QrContext['restaurant']; table: QrContext['table']; secondsLeft: number }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {(restaurant.logoWordmarkUrl ?? restaurant.logoUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(restaurant.logoWordmarkUrl ?? restaurant.logoUrl)!} alt={restaurant.name} className="h-14 max-w-[220px] rounded-2xl object-contain mx-auto shadow-md mb-6" />
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-md mb-6">
          {restaurant.name[0]}
        </div>
      )}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you for dining with us!</h1>
      <p className="text-sm text-gray-500 mb-1">
        Table {table.tableNumber}{table.floorSection ? ` · ${table.floorSection.name}` : ''}
      </p>
      <p className="text-sm font-medium text-gray-700 mb-8">{restaurant.name}</p>
      <p className="text-sm text-gray-400">We hope to see you again soon 😊</p>
      <p className="text-xs text-gray-300 mt-4">Returning in {secondsLeft}s…</p>
    </div>
  )
}

interface Props {
  restaurantId: string
  tableId: string
  initialContext: QrContext
}

export function QrShell({ restaurantId, tableId, initialContext }: Props) {
  const { restaurant, table } = initialContext

  // Apply restaurant brand color on mount
  useEffect(() => { applyBrandColor(restaurant.brandColor) }, [restaurant.brandColor])

  // Store
  const { guestToken, orderId, cart, view, setGuestToken, setOrderId, setCart, setView, itemCount } = useQrCart()

  // Track whether we've ever seen an active session (to distinguish "session closed by staff"
  // from "fresh AVAILABLE table with no session yet" after Change 2 backend fix)
  const hadActiveSessionRef = useRef(!!initialContext.activeSession)

  // Local UI state
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  // cartOpen no longer used — top cart bar replaces the drawer
  const [upsells, setUpsells] = useState<MenuItem[]>([])
  const [pendingUpsellItem, setPendingUpsellItem] = useState<MenuItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // browseOnly: table has an active session from another device — menu is visible but ordering is locked
  const [browseOnly, setBrowseOnly] = useState(false)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const menuRef = useRef<HTMLDivElement>(null)

  // Cart drawer
  const [cartOpen, setCartOpen] = useState(false)
  const [tableCarts, setTableCarts] = useState<TableCart[]>([])
  const [sessionClosed, setSessionClosed] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // Guest identity
  const NAME_KEY = `qr_name_${tableId}`
  const [personName, setPersonName] = useState<string | null>(null)
  const [showJoin, setShowJoin] = useState(false)
  const [nameSheetOpen, setNameSheetOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // On mount: check name first, then hydrate session
  useEffect(() => {
    const savedName = sessionStorage.getItem(NAME_KEY)
    const token = sessionStorage.getItem(`qr_guest_${restaurantId}`)
    const storedOrderId = sessionStorage.getItem(`qr_order_${restaurantId}`)

    // Customer returning to track a prior order (session may be closed by staff)
    if (!initialContext.activeSession && storedOrderId && token) {
      setPersonName(savedName ?? 'Guest')
      useQrCart.setState({ guestToken: token, orderId: storedOrderId })
      setView('tracking')
      return
    }

    // Table is being cleaned by staff — ordering not possible right now
    if (table.status === 'CLEANING' && !initialContext.activeSession) {
      setView('session_ended')
      return
    }

    if (savedName !== null) {
      // Already named (or explicitly chose guest) — go straight to session
      setPersonName(savedName)
      useQrCart.setState({ guestToken: token, orderId: storedOrderId })
      if (storedOrderId && token) {
        setView('tracking')
      } else {
        initSession(token)
      }
    } else {
      // First visit — show join screen
      setShowJoin(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll table status every 30s — detect live session changes (covers menu, checkout, and tracking views).
  // - BILL_REQUESTED: lock ordering (browseOnly), redirect from checkout to menu
  // - CLEANING/AVAILABLE: session fully closed — redirect to tracking or session_ended
  useEffect(() => {
    if (view !== 'menu' && view !== 'checkout' && view !== 'tracking') return
    const interval = setInterval(async () => {
      try {
        const ctx = await qrApi.resolveTable(restaurantId, tableId)
        const tableDone = (ctx.table.status === 'CLEANING' || ctx.table.status === 'AVAILABLE') && !ctx.activeSession

        // Update ref so we know a session was open at some point
        if (ctx.activeSession) hadActiveSessionRef.current = true

        if (tableDone) {
          if (view === 'tracking') {
            // Session closed while customer is on tracking — show thank you screen
            sessionStorage.removeItem(`qr_order_${restaurantId}`)
            useQrCart.setState({ orderId: null })
            setSessionClosed(true)
          } else {
            // On menu or checkout — redirect to tracking if order exists, else session_ended
            const storedOrderId = sessionStorage.getItem(`qr_order_${restaurantId}`)
            const token = sessionStorage.getItem(`qr_guest_${restaurantId}`)
            if (storedOrderId && token) {
              useQrCart.setState({ guestToken: token, orderId: storedOrderId })
              setView('tracking')
            } else if (hadActiveSessionRef.current) {
              // Session was open earlier but staff closed it before customer ordered
              setView('session_ended')
            }
            // else: fresh AVAILABLE table (no prior session) — customer is still browsing, do nothing
          }
        } else if (ctx.activeSession?.status === 'BILL_REQUESTED' && !browseOnly && view !== 'tracking') {
          // Bill requested — lock ordering for guests still on menu/checkout
          setBrowseOnly(true)
          if (view === 'checkout') setView('menu')
          showToast('Ordering has closed — bill in progress')
        }
      } catch { /* ignore polling errors */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [view, browseOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hot-reload: poll all carts + own cart every 3s while menu/checkout is visible.
  // When another guest places the table order, our cart disappears — detect this and
  // redirect to tracking by looking up the merged orderId via getMyOrder.
  useEffect(() => {
    if ((view !== 'menu' && view !== 'checkout') || !guestToken) return
    const interval = setInterval(() => {
      qrApi.getTableCarts(restaurantId, tableId).then(setTableCarts).catch(() => {})
      qrApi.getCart(restaurantId, guestToken)
        .then(setCart)
        .catch(() => {
          // Cart gone — another guest may have placed the merged table order
          qrApi.getMyOrder(restaurantId, guestToken)
            .then(({ orderId }) => {
              setOrderId(restaurantId, orderId)
              setView('tracking')
            })
            .catch(() => {})
        })
    }, 3000)
    return () => clearInterval(interval)
  }, [view, guestToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-redirect: after ThankYouScreen, count down 5s then reset to JoinScreen
  useEffect(() => {
    if (!sessionClosed) return
    setCountdown(5)
    const interval = setInterval(() => setCountdown((c) => c - 1), 1000)
    const timer = setTimeout(() => {
      clearInterval(interval)
      sessionStorage.removeItem(NAME_KEY)
      sessionStorage.removeItem(`qr_guest_${restaurantId}`)
      sessionStorage.removeItem(`qr_order_${restaurantId}`)
      useQrCart.setState({ guestToken: null, orderId: null, cart: null, view: 'menu' })
      setPersonName(null)
      setCategories([])
      setActiveCategory('')
      setBrowseOnly(false)
      setSessionClosed(false)
      setShowJoin(true)
    }, 5000)
    return () => { clearInterval(interval); clearTimeout(timer) }
  }, [sessionClosed]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleJoin(name: string) {
    const resolvedName = name || 'Guest'
    sessionStorage.setItem(NAME_KEY, resolvedName)
    setPersonName(resolvedName)
    setShowJoin(false)

    // Call identifyGuest if a real name was given
    const token = sessionStorage.getItem(`qr_guest_${restaurantId}`)
    if (name && token) {
      try { await qrApi.identifyGuest(restaurantId, { guestToken: token, firstName: name }) } catch { /* non-critical */ }
    }

    const storedOrderId = sessionStorage.getItem(`qr_order_${restaurantId}`)
    useQrCart.setState({ guestToken: token, orderId: storedOrderId })
    if (storedOrderId && token) {
      setView('tracking')
    } else {
      initSession(token)
    }
  }

  function openNameSheet() {
    setNameInput(personName === 'Guest' ? '' : (personName ?? ''))
    setNameSheetOpen(true)
  }

  function saveNameSheet() {
    const resolved = nameInput.trim() || 'Guest'
    sessionStorage.setItem(NAME_KEY, resolved)
    setPersonName(resolved)
    setNameSheetOpen(false)
    const token = sessionStorage.getItem(`qr_guest_${restaurantId}`)
    if (nameInput.trim() && token) {
      qrApi.identifyGuest(restaurantId, { guestToken: token, firstName: nameInput.trim() }).catch(() => {})
    }
  }

  async function initSession(existingToken?: string | null) {
    try {
      setView('loading')
      // Fetch menu
      const menu = await qrApi.getMenu(restaurantId)
      setCategories(menu)
      if (menu.length > 0) setActiveCategory(menu[0].id)

      // Use passed token; fall back to current store value (e.g. when called from handleNewOrder)
      const token = existingToken !== undefined ? existingToken : guestToken

      // Browse-only when bill has been requested — session is closing, no new orders allowed
      if (initialContext.activeSession?.status === 'BILL_REQUESTED') {
        setBrowseOnly(true)
        setView('menu')
        return
      }

      const deviceId = getOrCreateDeviceId()
      let activeToken: string
      if (!token) {
        const { guestToken: newToken } = await qrApi.initCart(restaurantId, tableId, deviceId)
        setGuestToken(restaurantId, newToken)
        activeToken = newToken
      } else {
        // Rehydrate cart
        try {
          const existing = await qrApi.getCart(restaurantId, token)
          setCart(existing)
          activeToken = token
        } catch {
          // Cart expired → create fresh
          const { guestToken: newToken } = await qrApi.initCart(restaurantId, tableId, deviceId)
          setGuestToken(restaurantId, newToken)
          activeToken = newToken
        }
      }

      // Persist guest name to Redis cart now that we have an active token
      const savedName = sessionStorage.getItem(NAME_KEY)
      if (savedName && savedName !== 'Guest' && activeToken) {
        qrApi.identifyGuest(restaurantId, { guestToken: activeToken, firstName: savedName }).catch(() => {})
      }

      setView('menu')
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please scan the QR code again.')
    }
  }

  function refreshAll() {
    qrApi.getTableCarts(restaurantId, tableId).then(setTableCarts).catch(() => {})
    if (guestToken) qrApi.getCart(restaurantId, guestToken).then(setCart).catch(() => {})
  }

  // Category tab click → scroll to section
  function scrollToCategory(catId: string) {
    setActiveCategory(catId)
    categoryRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Observe which category is in view
  useEffect(() => {
    if (!menuRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-cat-id')
            if (id) setActiveCategory(id)
          }
        })
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    )
    Object.values(categoryRefs.current).forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [categories])

  async function handleAddItem(itemId: string, qty: number, modifiers: { modifierId: string }[], notes: string) {
    if (!guestToken) return
    // Capture name before modal closes (selectedItem will be null by the time API responds)
    const itemName = selectedItem?.name ?? 'Item'
    try {
      const updated = await qrApi.addItem(restaurantId, { guestToken, itemId, quantity: qty, modifiers, notes: notes || undefined })
      setCart(updated)

      // Fetch upsells
      try {
        const { suggestions } = await qrApi.getUpsells(restaurantId, itemId)
        if (suggestions.length > 0) setUpsells(suggestions)
      } catch { /* ignore */ }

      showToast(`${itemName} added!`)
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to add item')
    }
  }

  async function handleUpdateItem(cartItemId: string, qty: number) {
    if (!guestToken) return
    const updated = await qrApi.updateItem(restaurantId, cartItemId, { guestToken, quantity: qty })
    setCart(updated)
  }

  async function handleRemoveItem(cartItemId: string) {
    if (!guestToken) return
    const updated = await qrApi.removeItem(restaurantId, cartItemId, guestToken)
    setCart(updated)
  }

  async function handlePlaceOrder(payPref: 'pay_now' | 'pay_later', tip: number, guestCount: number) {
    if (!guestToken) return
    const placed = await qrApi.placeOrder(restaurantId, {
      guestToken,
      tableId,
      guestCount,
      tipAmount: tip,
      paymentPreference: payPref,
    })
    setOrderId(restaurantId, placed.orderId)
    setView('tracking')

    if (payPref === 'pay_now' && placed.payNowUrl) {
      window.location.href = placed.payNowUrl
    }
  }

  function handleUpsellSelect(item: MenuItem) {
    setUpsells([])
    setSelectedItem(item)
  }

  function handleNewOrder() {
    // Keep guestToken but clear orderId so user can add more items
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`qr_order_${restaurantId}`)
    }
    useQrCart.setState({ orderId: null, view: 'menu' })
    initSession()
  }

  // ─── Render states ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-4xl mb-4">😕</div>
          <p className="font-bold text-gray-900 text-lg mb-2">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button onClick={() => initSession()} className="px-6 py-3 rounded-2xl bg-brand text-white font-semibold text-sm">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (view === 'session_ended') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo */}
        <div className="mb-6">
          {(restaurant.logoWordmarkUrl ?? restaurant.logoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(restaurant.logoWordmarkUrl ?? restaurant.logoUrl)!} alt={restaurant.name} className="h-14 max-w-[220px] rounded-2xl object-contain mx-auto shadow-md" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white font-bold text-2xl mx-auto shadow-md">
              {restaurant.name[0]}
            </div>
          )}
        </div>
        <div className="text-5xl mb-4">🧹</div>
        <p className="font-bold text-gray-900 text-xl mb-2">Session has ended</p>
        <p className="text-gray-500 text-sm mb-1">
          The table session was closed by staff.
        </p>
        <p className="text-gray-400 text-xs mb-8">
          Please ask your server to open a new session, or scan the QR code again.
        </p>
        <div className="w-full max-w-xs bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{restaurant.name}</p>
          <p className="text-sm font-bold text-gray-900">
            Table {table.tableNumber}{table.floorSection ? ` · ${table.floorSection.name}` : ''}
          </p>
        </div>
      </div>
    )
  }

  if (showJoin) {
    return <JoinScreen restaurant={restaurant} table={table} onJoin={handleJoin} />
  }

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-3">
        <Spinner className="text-brand h-8 w-8" />
        <p className="text-gray-500 text-sm">Loading menu…</p>
      </div>
    )
  }

  if (sessionClosed) {
    return <ThankYouScreen restaurant={restaurant} table={table} secondsLeft={countdown} />
  }

  if (view === 'tracking' && orderId && guestToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logoUrl} alt={restaurant.name} className="h-8 max-w-[72px] rounded-md object-contain bg-gray-50 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white font-bold text-sm">
              {restaurant.name[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">{restaurant.name}</p>
            <p className="text-xs text-gray-400">Table {table.tableNumber}</p>
          </div>
          <button
            onClick={handleNewOrder}
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Add more items"
          >
            <CartIcon size={24} className="text-gray-400" />
          </button>
        </div>

        <OrderTracker
          orderId={orderId}
          guestToken={guestToken}
          restaurant={restaurant}
          table={table}
          currency={restaurant.currency}
          onNewOrder={handleNewOrder}
          onOrderDone={() => {
            sessionStorage.removeItem(`qr_order_${restaurantId}`)
            useQrCart.setState({ orderId: null })
            setSessionClosed(true)
          }}
        />
      </div>
    )
  }

  // Checkout view
  if (view === 'checkout' && cart && guestToken) {
    return (
      <CheckoutPage
        cart={cart}
        restaurant={restaurant}
        table={table}
        restaurantId={restaurantId}
        tableId={tableId}
        guestToken={guestToken}
        personName={personName ?? 'Guest'}
        tableCarts={tableCarts}
        onBack={() => setView('menu')}
        onUpdate={handleUpdateItem}
        onRemove={handleRemoveItem}
        onRefresh={refreshAll}
        onPlaceOrder={handlePlaceOrder}
      />
    )
  }

  // Menu view
  const totalItems = itemCount()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header + table confirmation banner (one sticky block) */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          {restaurant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logoUrl} alt={restaurant.name} className="h-9 max-w-[80px] rounded-md object-contain bg-gray-50 shadow-sm flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center text-white font-bold">
              {restaurant.name[0]}
            </div>
          )}
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm leading-tight">{restaurant.name}</p>
            <p className="text-xs text-gray-400">Table {table.tableNumber}{table.floorSection ? ` · ${table.floorSection.name}` : ''}</p>
          </div>
          {!browseOnly && (
            <div className="flex items-center gap-1">
              {/* Share button */}
              <button
                onClick={async () => {
                  const url = window.location.href
                  const shareData = {
                    title: `Order at ${restaurant.name}`,
                    text: `Scan to order at Table ${table.tableNumber} · ${restaurant.name}`,
                    url,
                  }
                  if (navigator.share) {
                    try { await navigator.share(shareData) } catch { /* dismissed */ }
                  } else {
                    await navigator.clipboard.writeText(url)
                    showToast('Link copied!')
                  }
                }}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Share table link"
              >
                <Share2 size={18} className="text-gray-500" />
              </button>

              {/* Cart button */}
              <button
                onClick={() => { if (totalItems > 0) { refreshAll(); setCartOpen(true) } }}
                className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                aria-label="View cart"
              >
                <CartIcon size={24} className={totalItems > 0 ? 'text-brand' : 'text-gray-400'} />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
        {/* Table confirmation + guest name row */}
        <div className="bg-brand/10 border-b border-brand/20 px-4 py-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-brand">
            📍 {browseOnly ? 'Viewing menu at' : 'Ordering at'} Table {table.tableNumber}{table.floorSection ? ` · ${table.floorSection.name}` : ''} · {restaurant.name}
          </span>
          {!browseOnly && (
            <button
              onClick={openNameSheet}
              className="flex items-center gap-1 shrink-0 bg-white border border-brand/30 rounded-full px-2.5 py-0.5 text-xs font-medium text-brand hover:bg-brand/10 transition-colors"
            >
              <span>👤</span>
              <span className="max-w-[80px] truncate">{personName ?? 'Guest'}</span>
              <span className="text-brand/60">›</span>
            </button>
          )}
        </div>
        {/* Browse-only banner */}
        {browseOnly && (
          <div className={cn(
            'border-b px-4 py-2 flex items-center gap-2',
            initialContext.activeSession?.status === 'BILL_REQUESTED'
              ? 'bg-amber-50 border-amber-100'
              : 'bg-blue-50 border-blue-100',
          )}>
            <span className="text-base">
              {initialContext.activeSession?.status === 'BILL_REQUESTED' ? '🧾' : '🍽️'}
            </span>
            <span className={cn(
              'text-xs font-medium',
              initialContext.activeSession?.status === 'BILL_REQUESTED'
                ? 'text-amber-700'
                : 'text-blue-700',
            )}>
              {initialContext.activeSession?.status === 'BILL_REQUESTED'
                ? 'Bill in progress — ordering is closed for this table'
                : 'This table has an active order — browsing only'}
            </span>
          </div>
        )}
        {/* Category tabs */}
        {categories.length > 0 && (
          <div className="bg-white border-b border-gray-100 overflow-x-auto">
            <div className="flex gap-1 px-3 py-2 min-w-max">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                    activeCategory === cat.id
                      ? 'bg-brand text-white'
                      : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Menu sections */}
      <div ref={menuRef} className="flex-1 overflow-y-auto pb-10 px-4 pt-3 space-y-6">
        {categories.map((cat) => {
          const available = cat.items.filter((i) => i.isAvailable)
          const unavailable = cat.items.filter((i) => !i.isAvailable)
          return (
            <div
              key={cat.id}
              data-cat-id={cat.id}
              ref={(el) => { categoryRefs.current[cat.id] = el }}
            >
              <h2 className="font-bold text-gray-900 text-base mb-3">{cat.name}</h2>
              <div className="space-y-2">
                {[...available, ...unavailable].map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    currency={restaurant.currency}
                    onPress={browseOnly
                      ? () => showToast('Ordering not available — this table already has an active order')
                      : () => setSelectedItem(item)
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && cart && guestToken && (
        <CartDrawer
          cart={cart}
          restaurant={restaurant}
          table={table}
          restaurantId={restaurantId}
          guestToken={guestToken}
          personName={personName ?? 'Guest'}
          tableCarts={tableCarts}
          onClose={() => setCartOpen(false)}
          onUpdate={handleUpdateItem}
          onRemove={handleRemoveItem}
          onRefresh={refreshAll}
          onProceedToCheckout={() => { setCartOpen(false); refreshAll(); setView('checkout') }}
        />
      )}

      {/* Item sheet */}
      {selectedItem && (
        <ItemSheet
          item={selectedItem}
          currency={restaurant.currency}
          onClose={() => setSelectedItem(null)}
          onAdd={handleAddItem}
        />
      )}


      {/* Upsell modal */}
      {upsells.length > 0 && (
        <UpsellModal
          suggestions={upsells}
          currency={restaurant.currency}
          onSelect={handleUpsellSelect}
          onDismiss={() => setUpsells([])}
        />
      )}

      {/* Name edit sheet */}
      {nameSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNameSheetOpen(false)} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-bold text-gray-900 text-base mb-1">Change your name</p>
            <p className="text-sm text-gray-500 mb-4">So everyone at the table knows who ordered what.</p>
            <input
              type="text"
              placeholder="Your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNameSheet() }}
              maxLength={40}
              autoFocus
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand mb-3"
            />
            <button
              onClick={saveNameSheet}
              className="w-full bg-brand text-white font-semibold py-3.5 rounded-2xl text-sm"
            >
              {nameInput.trim() ? `Save as ${nameInput.trim()}` : 'Continue as Guest'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
