'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import type { OnlineCart, OnlineRestaurant } from '../../types/online.types'
import { cn, fmtPrice } from '../../lib/utils'

interface Props {
  cart: OnlineCart
  restaurant: OnlineRestaurant
  onClose: () => void
  onUpdate: (cartItemId: string, quantity: number) => void
  onRemove: (cartItemId: string) => void
  onProceedToCheckout: () => void
}

export default function CartDrawer({ cart, restaurant, onClose, onUpdate, onRemove, onProceedToCheckout }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  const taxRate = Number(restaurant.taxRate) / 100
  const taxEstimate = restaurant.taxInclusive ? 0 : cart.subtotal * taxRate
  const svcEstimate = cart.subtotal * (Number(restaurant.serviceCharge) / 100)
  const total = cart.subtotal + taxEstimate + svcEstimate
  const cur = restaurant.currency

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={dismiss}>
      {/* Backdrop */}
      <div className={cn(
        'absolute inset-0 bg-black/50 transition-opacity duration-250',
        visible ? 'opacity-100' : 'opacity-0',
      )} />

      {/* Side sheet */}
      <div
        className={cn(
          'relative w-[88vw] max-w-sm h-full bg-white flex flex-col shadow-2xl',
          'transition-transform duration-250 ease-out will-change-transform',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h2 className="font-bold text-gray-900 text-base flex-1">Your Cart</h2>
          <span className="text-sm text-gray-400">{cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {cart.items.map((item) => (
            <div key={item.cartItemId} className="py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</p>
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      {item.modifiers.map((m) => m.name).join(', ')}
                    </p>
                  )}
                  <p className="text-sm font-bold text-brand mt-1">
                    {fmtPrice(item.totalPrice, cur)}
                  </p>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <button
                    onClick={() => item.quantity <= 1 ? onRemove(item.cartItemId) : onUpdate(item.cartItemId, item.quantity - 1)}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
                      item.quantity <= 1
                        ? 'bg-red-50 text-red-400 hover:bg-red-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    )}
                  >
                    {item.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                  </button>
                  <span className="text-sm font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onUpdate(item.cartItemId, item.quantity + 1)}
                    className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand/90 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing + CTA */}
        <div className="shrink-0 border-t border-gray-100 px-4 pt-4 pb-6 space-y-3 bg-white">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-medium text-gray-700">{fmtPrice(cart.subtotal, cur)}</span>
            </div>
            {!restaurant.taxInclusive && taxEstimate > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax ({restaurant.taxRate}%)</span>
                <span className="font-medium text-gray-700">{fmtPrice(taxEstimate, cur)}</span>
              </div>
            )}
            {svcEstimate > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Service charge</span>
                <span className="font-medium text-gray-700">{fmtPrice(svcEstimate, cur)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{fmtPrice(total, cur)}</span>
            </div>
            <p className="text-xs text-gray-400">Delivery fee calculated at checkout</p>
          </div>

          <button
            onClick={() => { dismiss(); setTimeout(onProceedToCheckout, 250) }}
            className="w-full bg-brand text-white font-bold py-3.5 rounded-2xl text-base active:scale-[0.98] transition-transform"
          >
            Proceed to Checkout · {fmtPrice(total, cur)}
          </button>
        </div>
      </div>
    </div>
  )
}
