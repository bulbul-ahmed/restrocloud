'use client'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, ChefHat, Bell, Star, Phone } from 'lucide-react'
import { cn, fmtPrice } from '../../lib/utils'
import type { OrderTracking, QrRestaurant, QrTable, SessionSummary } from '../../types/qr.types'
import { qrApi } from '../../lib/qr.api'
import { Spinner } from './Spinner'
import { FeedbackModal } from './FeedbackModal'

const STATUS_STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']

const ROUND_STATUS_LABEL: Record<string, string> = {
  PENDING:   'Received',
  ACCEPTED:  'Confirmed',
  PREPARING: 'Preparing',
  READY:     'Ready',
  SERVED:    'Served',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED:  'Refunded',
}

const ROUND_STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  ACCEPTED:  'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY:     'bg-green-100 text-green-700',
  SERVED:    'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED:  'bg-purple-100 text-purple-700',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Order Received',
  ACCEPTED:  'Confirmed',
  PREPARING: 'Being Prepared',
  READY:     'Ready to Serve!',
  SERVED:    'Enjoy Your Meal!',
  COMPLETED: 'All Done',
  CANCELLED: 'Cancelled',
  REFUNDED:  'Refunded',
}

// Matches backend KitchenStatus enum: QUEUED, ACKNOWLEDGED, PREPARING, READY, SERVED, CANCELLED
const KITCHEN_LABEL: Record<string, { label: string; color: string }> = {
  QUEUED:       { label: 'Queued',   color: 'bg-gray-100 text-gray-600'   },
  ACKNOWLEDGED: { label: 'Noted',    color: 'bg-blue-100 text-blue-600'   },
  PREPARING:    { label: 'Cooking',  color: 'bg-orange-100 text-orange-700' },
  READY:        { label: 'Ready',    color: 'bg-green-100 text-green-700'  },
  SERVED:       { label: 'Served',   color: 'bg-teal-100 text-teal-600'   },
  CANCELLED:    { label: 'Cancelled',color: 'bg-red-100 text-red-600'     },
}

interface Props {
  orderId: string
  guestToken: string
  restaurant: QrRestaurant
  table: QrTable
  currency: string
  onNewOrder: () => void
  onOrderDone?: () => void
}

export function OrderTracker({ orderId, guestToken, restaurant, table, currency, onNewOrder, onOrderDone }: Props) {
  const [order, setOrder] = useState<OrderTracking | null>(null)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [billRequested, setBillRequested] = useState(false)
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [staffOnline, setStaffOnline] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackDone, setFeedbackDone] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchOrder() {
    try {
      const data = await qrApi.trackOrder(restaurant.id, orderId, guestToken)
      setOrder(data)
      // Stop polling when completed or cancelled
      if (['COMPLETED', 'CANCELLED'].includes(data.status)) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (data.status === 'COMPLETED' && !feedbackDone) {
          setTimeout(() => setShowFeedback(true), 1500)
          // Fallback: if feedback modal is dismissed or never interacted with, transition after 2 min
          setTimeout(() => onOrderDone?.(), 120_000)
        }
      }
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      if (msg.includes('403') || msg.toLowerCase().includes('access denied') || msg.includes('404')) {
        // Expired Redis key or invalid token — clear session and go back to menu
        if (intervalRef.current) clearInterval(intervalRef.current)
        onNewOrder()
      }
      // Otherwise keep showing stale data
    }
  }

  async function fetchSessionSummary() {
    try {
      const data = await qrApi.getSessionSummary(restaurant.id, guestToken)
      setSessionSummary(data)
    } catch {
      // Gracefully degrade — single-order view still works
    }
  }

  async function checkStaffOnline() {
    try {
      const { available } = await qrApi.isStaffOnline(restaurant.id)
      setStaffOnline(available)
    } catch {
      setStaffOnline(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    fetchSessionSummary()
    checkStaffOnline()
    intervalRef.current = setInterval(() => {
      fetchOrder()
      fetchSessionSummary()
      checkStaffOnline()
    }, 15000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [orderId])

  async function handleRequestBill() {
    setActionLoading('bill')
    try {
      await qrApi.requestBill(restaurant.id, orderId, guestToken)
      setBillRequested(true)
    } catch { /* already requested */ }
    finally { setActionLoading(null) }
  }

  async function handleCallWaiter() {
    setActionLoading('waiter')
    try {
      await qrApi.callWaiter(restaurant.id, guestToken)
      setWaiterCalled(true)
      setTimeout(() => setWaiterCalled(false), 10000)
    } finally { setActionLoading(null) }
  }

  if (!order) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="text-brand h-8 w-8" />
      </div>
    )
  }

  const currentStep = STATUS_STEPS.indexOf(order.status)
  const isCompleted = order.status === 'COMPLETED'
  const isServed    = order.status === 'SERVED'
  const isCancelled = order.status === 'CANCELLED'
  const isDone      = isCompleted || isServed

  // Reusable status card and progress bar blocks (rendered at top OR bottom depending on state)
  const statusCard = (
    <div className={cn(
      'mx-4 rounded-3xl p-5 text-white',
      isCancelled ? 'bg-red-500' :
      isCompleted ? 'bg-green-500' :
      isServed    ? 'bg-teal-500' :
                    'bg-brand',
    )}>
      <div className="flex items-center gap-3">
        {isDone ? (
          <CheckCircle2 size={32} strokeWidth={2} />
        ) : isCancelled ? (
          <div className="text-2xl">❌</div>
        ) : (
          <div className="relative">
            <ChefHat size={32} strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white/80 animate-pulse" />
          </div>
        )}
        <div>
          <p className="font-bold text-xl">{STATUS_LABEL[order.status] ?? order.status}</p>
          <p className="text-white/80 text-sm">Order #{order.orderNumber}</p>
        </div>
      </div>
      {order.estimatedReadyAt && !isDone && (
        <div className="flex items-center gap-1.5 mt-3 bg-white/20 rounded-xl px-3 py-2">
          <Clock size={14} />
          <span className="text-sm">
            Ready by {new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  )

  const progressBar = !isCancelled ? (
    <div className="mx-4">
      <div className="flex items-center">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentStep
          const active = i === currentStep
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors',
                done ? 'bg-brand border-brand' : 'bg-white border-gray-200',
                active && 'ring-2 ring-brand/30',
              )}>
                {done ? (
                  <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1', i < currentStep ? 'bg-brand' : 'bg-gray-200')} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {STATUS_STEPS.map((step) => (
          <span key={step} className="text-[9px] text-gray-400 text-center flex-1">
            {STATUS_LABEL[step]}
          </span>
        ))}
      </div>
    </div>
  ) : null

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── STATUS CARD + PROGRESS — shown at TOP when order is in progress ── */}
      {!isCompleted && (
        <div className="mt-4 space-y-5">
          {statusCard}
          {progressBar}
        </div>
      )}

      {/* Items */}
      <div className="mx-4 mt-5">
        <p className="font-bold text-gray-800 text-sm mb-2">Items</p>
        <div className="space-y-2">
          {order.items.map((item) => {
            const k = KITCHEN_LABEL[item.kitchenStatus] ?? { label: item.kitchenStatus, color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={item.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 gap-3">
                <span className="text-sm font-medium text-gray-800 flex-1">{item.quantity}× {item.name}</span>
                {isCompleted
                  ? <span className="text-sm font-semibold text-gray-700 shrink-0">{fmtPrice(item.totalPrice, order.currency)}</span>
                  : <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0', k.color)}>{k.label}</span>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Receipt summary — only when completed */}
      {isCompleted && (
        <div className="mx-4 mt-4 bg-white border border-gray-100 rounded-2xl px-4 py-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{fmtPrice(order.subtotal, order.currency)}</span>
          </div>
          {order.taxAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>{fmtPrice(order.taxAmount, order.currency)}</span>
            </div>
          )}
          {order.serviceChargeAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Service charge</span>
              <span>{fmtPrice(order.serviceChargeAmount, order.currency)}</span>
            </div>
          )}
          {order.tipAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip</span>
              <span>{fmtPrice(order.tipAmount, order.currency)}</span>
            </div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>−{fmtPrice(order.discountAmount, order.currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span className="text-brand">{fmtPrice(order.totalAmount, order.currency)}</span>
          </div>
        </div>
      )}

      {/* Request printed receipt — only when completed and staff online */}
      {isCompleted && staffOnline && (
        <div className="mx-4 mt-3">
          <button
            onClick={async () => {
              setActionLoading('receipt')
              try {
                await qrApi.callWaiter(restaurant.id, guestToken, 'Please bring the printed receipt to the table.')
                setWaiterCalled(true)
                setTimeout(() => setWaiterCalled(false), 8000)
              } finally { setActionLoading(null) }
            }}
            disabled={waiterCalled || actionLoading === 'receipt'}
            className={cn(
              'w-full py-3.5 rounded-2xl border-2 text-sm font-semibold transition-colors',
              waiterCalled
                ? 'border-green-400 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-700',
            )}
          >
            {actionLoading === 'receipt' ? (
              <span className="flex items-center justify-center gap-2"><Spinner className="text-gray-500" /> Requesting…</span>
            ) : waiterCalled ? (
              '✓ Receipt requested — staff notified'
            ) : (
              '🖨 Request Printed Receipt'
            )}
          </button>
        </div>
      )}

      {/* Multi-round session summary */}
      {sessionSummary && sessionSummary.orderCount > 1 && (
        <div className="mx-4 mt-5">
          <p className="font-bold text-gray-800 text-sm mb-3">Your Full Order ({sessionSummary.orderCount} rounds)</p>
          <div className="space-y-3">
            {sessionSummary.orders.map((round) => (
              <div key={round.orderId} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-700">Round {round.round} · #{round.orderNumber}</span>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ROUND_STATUS_COLOR[round.status] ?? 'bg-gray-100 text-gray-600')}>
                    {ROUND_STATUS_LABEL[round.status] ?? round.status}
                  </span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {round.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}× {item.name}</span>
                      <span className="text-gray-500">{fmtPrice(item.totalPrice, currency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-3 py-2 border-t border-gray-50">
                  <span className="text-xs text-gray-500">Round total</span>
                  <span className="text-xs font-semibold text-gray-700">{fmtPrice(round.totalAmount, currency)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-1">
            <span className="text-sm font-bold text-gray-900">Total so far</span>
            <span className="text-sm font-bold text-brand">{fmtPrice(sessionSummary.sessionTotal, currency)}</span>
          </div>
        </div>
      )}

      {/* Action buttons — hidden when completed */}
      {!isCompleted && (
        <div className={cn('mx-4 mt-5 gap-3', staffOnline ? 'grid grid-cols-2' : 'flex')}>
          {staffOnline && (
            <button
              onClick={handleCallWaiter}
              disabled={actionLoading === 'waiter'}
              className={cn(
                'flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors',
                waiterCalled
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-700',
              )}
            >
              {actionLoading === 'waiter' ? <Spinner className="text-gray-500" /> : <Bell size={20} />}
              <span className="text-xs font-semibold">{waiterCalled ? 'Notified!' : 'Call Waiter'}</span>
            </button>
          )}

          <button
            onClick={handleRequestBill}
            disabled={billRequested || actionLoading === 'bill'}
            className={cn(
              'flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors',
              billRequested
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-gray-200 bg-white text-gray-700',
            )}
          >
            {actionLoading === 'bill' ? <Spinner className="text-brand" /> : <span className="text-xl">🧾</span>}
            <span className="text-xs font-semibold">{billRequested ? 'Bill Requested' : 'Request Bill'}</span>
          </button>
        </div>
      )}

      {/* Add More Items — hidden when completed or bill requested */}
      {!isCompleted && !billRequested && (
        <div className="mx-4 mt-4">
          <button
            onClick={onNewOrder}
            className="w-full py-3.5 rounded-2xl border-2 border-brand text-brand font-semibold text-sm"
          >
            + Add More Items
          </button>
        </div>
      )}

      {/* ── STATUS CARD + PROGRESS — shown at BOTTOM when order is completed ── */}
      {isCompleted && (
        <div className="mt-6 space-y-4 border-t border-gray-100 pt-5">
          {statusCard}
          {progressBar && <div className="pb-2">{progressBar}</div>}
        </div>
      )}

      <div className="mb-10" />

      {/* Feedback modal */}
      {showFeedback && !feedbackDone && (
        <FeedbackModal
          restaurantName={restaurant.name}
          onSubmit={async (rating, comment) => {
            await qrApi.submitFeedback(restaurant.id, orderId, { guestToken, rating, comment })
            setFeedbackDone(true)
            setShowFeedback(false)
            setTimeout(() => onOrderDone?.(), 3000)
          }}
          onDismiss={() => {
            setShowFeedback(false)
            setTimeout(() => onOrderDone?.(), 3000)
          }}
        />
      )}
    </div>
  )
}
