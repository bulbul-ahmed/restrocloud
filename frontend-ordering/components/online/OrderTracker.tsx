'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { RefreshCw, CheckCircle, XCircle, Clock, ChefHat, Package } from 'lucide-react'
import type { OnlineOrderTracking, OnlineRestaurant } from '../../types/online.types'
import * as onlineApi from '../../lib/online.api'
import { getOrderingSocket, disconnectOrderingSocket } from '../../lib/socket'
import { fmtPrice } from '../../lib/utils'

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'SERVED']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  PENDING: { label: 'Order Received', color: 'text-yellow-700', bg: 'bg-yellow-100', Icon: Clock },
  ACCEPTED: { label: 'Accepted', color: 'text-blue-700', bg: 'bg-blue-100', Icon: CheckCircle },
  PREPARING: { label: 'Being Prepared', color: 'text-orange-700', bg: 'bg-orange-100', Icon: ChefHat },
  READY: { label: 'Ready for Pickup', color: 'text-green-700', bg: 'bg-green-100', Icon: Package },
  COMPLETED: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100', Icon: CheckCircle },
  SERVED: { label: 'Served', color: 'text-emerald-700', bg: 'bg-emerald-100', Icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100', Icon: XCircle },
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } catch { return '' }
}

interface Props {
  slug: string
  orderId: string
  cartToken: string | null
  token: string | null
  restaurant: OnlineRestaurant
  onOrderAgain: () => void
}

export default function OrderTracker({ slug, orderId, cartToken, token, restaurant, onOrderAgain }: Props) {
  const [order, setOrder] = useState<OnlineOrderTracking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrder = useCallback(async () => {
    try {
      const o = await onlineApi.trackOrder(slug, orderId, cartToken, token)
      setOrder(o)
      return o
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load order')
      return null
    }
  }, [slug, orderId, cartToken, token])

  // Socket — instant updates via order room
  useEffect(() => {
    const socket = getOrderingSocket()

    function joinOrderRoom() {
      const payload: { orderId: string; cartToken?: string; customerId?: string } = { orderId }
      if (cartToken) payload.cartToken = cartToken
      socket.emit('join_order', payload)
    }

    // Join when connected (or immediately if already connected)
    if (socket.connected) {
      joinOrderRoom()
    } else {
      socket.once('connect', joinOrderRoom)
    }

    function onStatusChange(event: { orderId: string; newStatus: string }) {
      if (event.orderId !== orderId) return
      // Refetch full order details so timeline + amounts are fresh
      fetchOrder()
    }

    socket.on('order_status_change', onStatusChange)

    return () => {
      socket.off('order_status_change', onStatusChange)
      socket.off('connect', joinOrderRoom)
    }
  }, [orderId, cartToken, fetchOrder])

  // Polling fallback every 30s (socket is the primary update path)
  useEffect(() => {
    fetchOrder()
    const interval = setInterval(async () => {
      const o = await fetchOrder()
      if (o && TERMINAL_STATUSES.includes(o.status)) {
        clearInterval(interval)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchOrder])

  // Disconnect socket when component unmounts
  useEffect(() => {
    return () => disconnectOrderingSocket()
  }, [])

  // Auto-redirect to menu 5s after COMPLETED or SERVED
  useEffect(() => {
    if (!order) return
    if (order.status !== 'COMPLETED' && order.status !== 'SERVED') return
    setCountdown(5)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(countdownRef.current!)
          return null
        }
        return c - 1
      })
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status])

  // Fire onOrderAgain once countdown reaches null (outside render/updater)
  useEffect(() => {
    if (countdown === null && order?.status && ['COMPLETED', 'SERVED'].includes(order.status)) {
      onOrderAgain()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => { setError(null); fetchOrder() }} className="text-brand underline text-sm">Retry</button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-brand" />
      </div>
    )
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
  const isTerminal = TERMINAL_STATUSES.includes(order.status)
  const StatusIcon = cfg.Icon

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Restaurant branding bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        {restaurant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logoUrl} alt={restaurant.name} className="w-9 h-9 rounded-xl object-cover shadow-sm" />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
            {restaurant.name[0]}
          </div>
        )}
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm leading-tight">{restaurant.name}</p>
          <p className="text-xs text-gray-400">Order Tracking</p>
        </div>
        <button
          onClick={onOrderAgain}
          className="text-xs text-brand font-medium px-3 py-1.5 rounded-full border border-brand/30 hover:bg-brand/5 transition-colors"
        >
          ← Menu
        </button>
      </div>

      {/* Status hero */}
      <div className={`${cfg.bg} px-4 pt-10 pb-8 text-center`}>
        <StatusIcon size={48} className={`${cfg.color} mx-auto mb-3`} />
        <h1 className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</h1>
        <p className="text-gray-600 mt-1 text-sm">
          Order #{order.orderNumber}
          {!isTerminal && <span className="ml-2 text-xs">(live updates on)</span>}
        </p>
        {order.estimatedDeliveryMin && !isTerminal && (
          <p className="text-sm text-gray-600 mt-2">Estimated ~{order.estimatedDeliveryMin} min</p>
        )}
        {order.status === 'READY' && (
          <p className="mt-4 text-sm font-medium text-green-800 bg-white/70 rounded-full px-5 py-2 inline-block">
            🎉 Head to the counter to collect your order
          </p>
        )}
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
        {/* Status timeline */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="font-semibold text-gray-900 mb-4">Order Timeline</h2>
          <div className="space-y-3">
            {[...order.statusHistory].reverse().map((h, i) => {
              const hcfg = STATUS_CONFIG[h.status]
              return (
                <div key={i} className="flex gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${hcfg?.bg ?? 'bg-gray-200'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{hcfg?.label ?? h.status}</p>
                    <p className="text-xs text-gray-400">{fmtTime(h.changedAt)}</p>
                    {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Delivery address */}
        {order.deliveryAddress && (
          <div className="bg-white rounded-2xl p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Delivery Address</h2>
            <p className="text-sm text-gray-600">{order.deliveryAddress.line1}</p>
            {order.deliveryAddress.line2 && <p className="text-sm text-gray-600">{order.deliveryAddress.line2}</p>}
            <p className="text-sm text-gray-600">{order.deliveryAddress.area ? `${order.deliveryAddress.area}, ` : ''}{order.deliveryAddress.city}</p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-2xl p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Items</h2>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.quantity}× {item.name}</span>
                <span className="text-gray-900 font-medium">{fmtPrice(item.totalPrice, order.currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{fmtPrice(order.subtotal, order.currency)}</span>
            </div>
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span>{fmtPrice(order.taxAmount, order.currency)}</span>
              </div>
            )}
            {order.serviceCharge > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Service Charge</span>
                <span>{fmtPrice(order.serviceCharge, order.currency)}</span>
              </div>
            )}
            {order.tipAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tip</span>
                <span>{fmtPrice(order.tipAmount, order.currency)}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-500 text-green-600">
                <span>Discount</span>
                <span>-{fmtPrice(order.discountAmount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 pt-1.5 border-t border-gray-100">
              <span>Total</span>
              <span className="text-brand">{fmtPrice(order.totalAmount, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Order again */}
        {isTerminal && order.status !== 'CANCELLED' && (
          <div className="space-y-2">
            <p className="text-center text-sm text-gray-500">
              Thank you for ordering from{' '}
              <span className="font-semibold text-gray-700">{restaurant.name}</span>
            </p>
            {countdown !== null && (
              <p className="text-center text-xs text-gray-400">
                Returning to menu in {countdown}s…
              </p>
            )}
            <button
              onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); onOrderAgain() }}
              className="w-full bg-brand text-white font-semibold py-3.5 rounded-2xl text-base"
            >
              Order Again
            </button>
          </div>
        )}
        {order.status === 'CANCELLED' && (
          <button
            onClick={onOrderAgain}
            className="w-full border border-brand text-brand font-semibold py-3.5 rounded-2xl text-base"
          >
            Browse Menu
          </button>
        )}
      </div>
    </div>
  )
}
