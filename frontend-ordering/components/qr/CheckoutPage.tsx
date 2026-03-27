'use client'
import { useState } from 'react'
import { ArrowLeft, Minus, Plus, Trash2, Users, User } from 'lucide-react'
import { cn, fmtPrice } from '../../lib/utils'
import { qrApi } from '../../lib/qr.api'
import type { Cart, QrRestaurant, QrTable, TableCart } from '../../types/qr.types'
import { Spinner } from './Spinner'

interface Props {
  cart: Cart
  restaurant: QrRestaurant
  table: QrTable
  restaurantId: string
  tableId: string
  guestToken: string
  personName: string
  tableCarts: TableCart[]
  onBack: () => void
  onUpdate: (cartItemId: string, qty: number) => Promise<void>
  onRemove: (cartItemId: string) => Promise<void>
  onRefresh: () => void
  onPlaceOrder: (paymentPref: 'pay_now' | 'pay_later', tip: number, guestCount: number) => Promise<void>
}

export function CheckoutPage({
  cart, restaurant, table, restaurantId, tableId, guestToken, personName, tableCarts,
  onBack, onUpdate, onRemove, onRefresh, onPlaceOrder,
}: Props) {
  const { currency, tipOptions, taxRate, taxInclusive, serviceCharge } = restaurant

  const [tip, setTip] = useState(0)
  const [payPref, setPayPref] = useState<'pay_now' | 'pay_later'>('pay_later')
  const [placing, setPlacing] = useState(false)
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  // Use tableCarts prop directly — QrShell's 3s polling keeps it fresh
  const otherCarts = tableCarts.filter((tc) => tc.guestToken !== guestToken)

  // Current user totals
  const mySubtotal = cart.subtotal
  const tipAmt = Math.round((mySubtotal * tip) / 100)
  const myTotal = cart.totalEstimate + tipAmt

  // Grand total across all carts
  const othersSubtotal = otherCarts.reduce((s, tc) => s + tc.subtotalEstimate, 0)
  const allSubtotal = mySubtotal + othersSubtotal
  const allTax = taxInclusive ? 0 : Math.round(allSubtotal * taxRate / 100)
  const allSvc = Math.round(allSubtotal * serviceCharge / 100)
  const grandTotal = allSubtotal + allTax + allSvc + tipAmt

  const guestCount = tableCarts.length || 1

  async function handleUpdate(cartItemId: string, qty: number) {
    setLoadingItem(cartItemId)
    try { await onUpdate(cartItemId, qty) } finally { setLoadingItem(null) }
  }

  async function handleRemove(cartItemId: string) {
    setLoadingItem(cartItemId)
    try { await onRemove(cartItemId) } finally { setLoadingItem(null) }
  }

  async function handleOtherUpdate(tc: TableCart, cartItemId: string, newQty: number) {
    setLoadingItem(cartItemId)
    try {
      await qrApi.updateItem(restaurantId, cartItemId, { guestToken: tc.guestToken, quantity: newQty })
      onRefresh()
    } finally { setLoadingItem(null) }
  }

  async function handleOtherRemove(tc: TableCart, cartItemId: string) {
    setLoadingItem(cartItemId)
    try {
      await qrApi.removeItem(restaurantId, cartItemId, tc.guestToken)
      onRefresh()
    } finally { setLoadingItem(null) }
  }

  async function handlePlace() {
    setPlacing(true)
    try { await onPlaceOrder(payPref, tipAmt, guestCount) } finally { setPlacing(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-base">Checkout</p>
          <p className="text-xs text-gray-400">Table {table.tableNumber}{table.floorSection ? ` · ${table.floorSection.name}` : ''} · {personName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 px-4 pt-4 space-y-4">

        {/* ── Orders at this table ──────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Users size={14} className="text-brand" />
            <p className="font-semibold text-gray-900 text-sm">Orders at this table</p>
          </div>

          {/* Current user's cart */}
          <div className="border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
              <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <User size={11} className="text-brand" />
              </div>
              <span className="text-xs font-bold text-gray-800 flex-1">{personName}</span>
              <span className="text-[10px] bg-brand/20 text-brand font-semibold px-2 py-0.5 rounded-full">In Cart</span>
              <span className="text-xs font-bold text-brand">{fmtPrice(mySubtotal, currency)}</span>
            </div>
            {cart.items.map((item) => (
              <div key={item.cartItemId} className="flex gap-3 items-center px-4 py-2 ml-8">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {item.modifiers.map((m) => m.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">{item.quantity}×</span>
                <span className="text-xs font-semibold text-gray-800 shrink-0 w-14 text-right">{fmtPrice(item.totalPrice, currency)}</span>
                {loadingItem === item.cartItemId ? (
                  <Spinner className="text-brand w-4 h-4" />
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => item.quantity > 1 ? handleUpdate(item.cartItemId, item.quantity - 1) : handleRemove(item.cartItemId)}
                      className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                    >
                      {item.quantity === 1
                        ? <Trash2 size={10} className="text-red-400" />
                        : <Minus size={10} className="text-gray-600" />}
                    </button>
                    <span className="text-xs font-bold w-3 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdate(item.cartItemId, item.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-brand/10 border border-brand flex items-center justify-center"
                    >
                      <Plus size={10} className="text-brand" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="pb-3" />
          </div>

          {/* Other guests' carts (editable) */}
          {otherCarts.map((tc) => (
            <div key={tc.guestToken} className="border-t border-gray-50">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User size={11} className="text-gray-500" />
                </div>
                <span className="text-xs font-bold text-gray-800 flex-1">{tc.guestName || 'Guest'}</span>
                <span className="text-[10px] bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">In Cart</span>
                <span className="text-xs font-bold text-gray-700">{fmtPrice(tc.subtotalEstimate, currency)}</span>
              </div>
              {tc.items.map((item) => (
                <div key={item.cartItemId} className="flex gap-3 items-center px-4 py-2 ml-8">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{item.quantity}×</span>
                  <span className="text-xs font-semibold text-gray-800 shrink-0 w-14 text-right">{fmtPrice(item.totalPrice, currency)}</span>
                  {loadingItem === item.cartItemId ? (
                    <Spinner className="text-brand w-4 h-4" />
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => item.quantity > 1 ? handleOtherUpdate(tc, item.cartItemId, item.quantity - 1) : handleOtherRemove(tc, item.cartItemId)}
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center"
                      >
                        {item.quantity === 1
                          ? <Trash2 size={10} className="text-red-400" />
                          : <Minus size={10} className="text-gray-600" />}
                      </button>
                      <span className="text-xs font-bold w-3 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleOtherUpdate(tc, item.cartItemId, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-brand/10 border border-brand flex items-center justify-center"
                      >
                        <Plus size={10} className="text-brand" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="pb-3" />
            </div>
          ))}
        </section>

        {/* ── Combined Summary ──────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900 mb-1">Combined Summary</p>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal (all orders)</span>
            <span>{fmtPrice(allSubtotal, currency)}</span>
          </div>
          {allTax > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({taxRate}%)</span>
              <span>{fmtPrice(allTax, currency)}</span>
            </div>
          )}
          {allSvc > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Service charge ({serviceCharge}%)</span>
              <span>{fmtPrice(allSvc, currency)}</span>
            </div>
          )}
          {tipAmt > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip ({tip}%)</span>
              <span>{fmtPrice(tipAmt, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Grand Total</span>
            <span className="text-brand">{fmtPrice(grandTotal, currency)}</span>
          </div>
        </section>

        {/* ── Tip ──────────────────────────────────────────────── */}
        {tipOptions && tipOptions.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Add a tip?</p>
            <div className="flex gap-2 flex-wrap">
              {[0, ...tipOptions].map((t) => (
                <button
                  key={t}
                  onClick={() => setTip(t)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    tip === t ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600',
                  )}
                >
                  {t === 0 ? 'None' : `${t}%`}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Payment ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Payment</p>
          <div className="grid grid-cols-2 gap-2">
            {(['pay_later', 'pay_now'] as const).map((pref) => (
              <button
                key={pref}
                onClick={() => setPayPref(pref)}
                className={cn(
                  'py-3 rounded-xl text-sm font-medium border transition-colors',
                  payPref === pref ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600 bg-white',
                )}
              >
                {pref === 'pay_now' ? '💳 Pay Now' : '🧾 Pay Later'}
              </button>
            ))}
          </div>
          {payPref === 'pay_later' && (
            <p className="text-xs text-gray-400 mt-2 text-center">Staff will bring the bill to your table</p>
          )}
        </section>

        {/* ── Place Order ──────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-gray-500">
            Your order
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="font-semibold text-gray-800">{fmtPrice(myTotal, currency)}</span>
          </p>
          <button
            onClick={handlePlace}
            disabled={placing || cart.items.length === 0}
            className="flex items-center gap-2.5 px-10 py-3.5 rounded-2xl font-bold text-white text-sm bg-brand shadow-md shadow-brand/30 disabled:opacity-60 disabled:shadow-none active:scale-95 transition-transform"
          >
            {placing ? (
              <><Spinner className="text-white" /><span>Placing order…</span></>
            ) : (
              <><span>Place Order</span><span className="text-white/60">·</span><span>{fmtPrice(myTotal, currency)}</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
