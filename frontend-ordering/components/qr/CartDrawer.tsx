'use client'
import { useEffect, useState } from 'react'
import { ArrowLeft, Minus, Plus, Trash2, ShoppingCart, User } from 'lucide-react'
import { cn, fmtPrice } from '../../lib/utils'
import { qrApi } from '../../lib/qr.api'
import type { Cart, QrRestaurant, QrTable, TableCart } from '../../types/qr.types'
import { Spinner } from './Spinner'

interface Props {
  cart: Cart
  restaurant: QrRestaurant
  table: QrTable
  restaurantId: string
  guestToken: string
  personName: string
  tableCarts: TableCart[]
  onClose: () => void
  onUpdate: (cartItemId: string, qty: number) => Promise<void>
  onRemove: (cartItemId: string) => Promise<void>
  onRefresh: () => void
  onProceedToCheckout: () => void
}

export function CartDrawer({
  cart, restaurant, table, restaurantId, guestToken, personName, tableCarts,
  onClose, onUpdate, onRemove, onRefresh, onProceedToCheckout,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [loadingItem, setLoadingItem] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  // Current user edits — delegate to parent (updates QrShell's cart state)
  async function handleUpdate(cartItemId: string, qty: number) {
    setLoadingItem(cartItemId)
    try { await onUpdate(cartItemId, qty) } finally { setLoadingItem(null) }
  }

  async function handleRemove(cartItemId: string) {
    setLoadingItem(cartItemId)
    try { await onRemove(cartItemId) } finally { setLoadingItem(null) }
  }

  // Other guests' edits — call API directly, then trigger parent refresh
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

  const { currency, taxRate, taxInclusive, serviceCharge } = restaurant
  const otherCarts = tableCarts.filter((tc) => tc.guestToken !== guestToken)

  // Combined totals
  const mySubtotal = cart.subtotal
  const othersSubtotal = otherCarts.reduce((s, tc) => s + tc.subtotalEstimate, 0)
  const allSubtotal = mySubtotal + othersSubtotal
  const allTax = taxInclusive ? 0 : Math.round(allSubtotal * taxRate / 100)
  const allSvc = Math.round(allSubtotal * serviceCharge / 100)
  const allTotal = allSubtotal + allTax + allSvc

  const totalItemCount = cart.itemCount + otherCarts.reduce((s, tc) => s + tc.itemCount, 0)
  const tableLabel = `Table ${table.tableNumber}${table.floorSection ? ` · ${table.floorSection.name}` : ''}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={dismiss}>
      {/* Backdrop */}
      <div className={cn(
        'absolute inset-0 bg-black/50 transition-opacity duration-[250ms]',
        visible ? 'opacity-100' : 'opacity-0',
      )} />

      {/* Side panel */}
      <div
        className={cn(
          'relative w-[92vw] max-w-sm h-full bg-white flex flex-col shadow-2xl',
          'transition-transform duration-[250ms] ease-out will-change-transform',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h2 className="font-bold text-gray-900 text-base flex-1">Table Cart</h2>
          <span className="text-sm text-gray-400">{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Per-person cart sections */}
        <div className="flex-1 overflow-y-auto">

          {/* Empty state */}
          {cart.items.length === 0 && otherCarts.every((tc) => tc.items.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <ShoppingCart size={52} strokeWidth={1.2} className="text-gray-200 mb-4" />
              <p className="font-semibold text-gray-500 text-sm">No items yet</p>
              <p className="text-gray-400 text-xs mt-1">Tap items on the menu to add them</p>
            </div>
          )}

          {/* ── Current user ── */}
          {cart.items.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <User size={11} className="text-brand" />
                </div>
                <span className="text-xs font-bold text-gray-800 flex-1">{personName}</span>
                <span className="text-[10px] bg-brand/20 text-brand font-semibold px-2 py-0.5 rounded-full">You</span>
                <span className="text-xs font-bold text-brand">{fmtPrice(mySubtotal, currency)}</span>
              </div>

              {cart.items.map((item) => (
                <div key={item.cartItemId} className="flex items-start gap-3 px-4 py-3 ml-8 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug truncate">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>
                    )}
                    <p className="text-sm font-bold text-brand mt-1">{fmtPrice(item.totalPrice, currency)}</p>
                  </div>

                  {loadingItem === item.cartItemId ? (
                    <Spinner className="text-brand mt-1 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <button
                        onClick={() => item.quantity <= 1 ? handleRemove(item.cartItemId) : handleUpdate(item.cartItemId, item.quantity - 1)}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                          item.quantity <= 1 ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {item.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdate(item.cartItemId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="pb-2" />
            </div>
          )}

          {/* ── Other guests ── */}
          {otherCarts.map((tc) => (
            <div key={tc.guestToken} className="border-b border-gray-100">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User size={11} className="text-gray-500" />
                </div>
                <span className="text-xs font-bold text-gray-800 flex-1">{tc.guestName || 'Guest'}</span>
                <span className="text-[10px] bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">In Cart</span>
                <span className="text-xs font-bold text-gray-700">{fmtPrice(tc.subtotalEstimate, currency)}</span>
              </div>

              {tc.items.map((item) => (
                <div key={item.cartItemId} className="flex items-center gap-3 px-4 py-2.5 ml-8 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {item.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    <p className="text-sm font-bold text-gray-700 mt-0.5">{fmtPrice(item.totalPrice, currency)}</p>
                  </div>

                  {loadingItem === item.cartItemId ? (
                    <Spinner className="text-brand shrink-0" />
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => item.quantity <= 1 ? handleOtherRemove(tc, item.cartItemId) : handleOtherUpdate(tc, item.cartItemId, item.quantity - 1)}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                          item.quantity <= 1 ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {item.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => handleOtherUpdate(tc, item.cartItemId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div className="pb-2" />
            </div>
          ))}
        </div>

        {/* Pricing + CTA */}
        <div className="shrink-0 border-t border-gray-100 px-4 pt-4 pb-6 space-y-3 bg-white">
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal (all)</span>
              <span className="font-medium text-gray-700">{fmtPrice(allSubtotal, currency)}</span>
            </div>
            {allTax > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax ({taxRate}%)</span>
                <span className="font-medium text-gray-700">{fmtPrice(allTax, currency)}</span>
              </div>
            )}
            {allSvc > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Service charge ({serviceCharge}%)</span>
                <span className="font-medium text-gray-700">{fmtPrice(allSvc, currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Table Total</span>
              <span>{fmtPrice(allTotal, currency)}</span>
            </div>
            <p className="text-xs text-gray-400">{tableLabel}</p>
          </div>

          <button
            disabled={cart.items.length === 0}
            onClick={() => { dismiss(); setTimeout(onProceedToCheckout, 250) }}
            className="w-full bg-brand text-white font-bold py-3.5 rounded-2xl text-base active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Proceed to Checkout · {fmtPrice(cart.subtotal + cart.taxEstimate + cart.serviceChargeEstimate, currency)}
          </button>
          {cart.items.length === 0 && (
            <p className="text-xs text-center text-gray-400">Add items to your cart to proceed</p>
          )}
        </div>
      </div>
    </div>
  )
}
