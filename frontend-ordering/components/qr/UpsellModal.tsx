'use client'
import { X } from 'lucide-react'
import { fmtPrice } from '../../lib/utils'
import type { MenuItem } from '../../types/qr.types'

interface Props {
  suggestions: MenuItem[]
  currency: string
  onSelect: (item: MenuItem) => void
  onDismiss: () => void
}

export function UpsellModal({ suggestions, currency, onSelect, onDismiss }: Props) {
  if (suggestions.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onDismiss}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl px-4 pt-4 pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <button onClick={onDismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <X size={16} className="text-gray-600" />
        </button>
        <p className="font-bold text-gray-900 text-base mb-1">Frequently ordered together</p>
        <p className="text-xs text-gray-400 mb-4">Would you like to add anything else?</p>

        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4">
          {suggestions.map((item) => {
            const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="flex-shrink-0 w-32 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden text-left active:scale-95 transition-transform"
              >
                <div className="relative w-full h-24 bg-brand/10 flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🍽️</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
                  <p className="text-xs text-brand font-bold mt-1">{fmtPrice(price, currency)}</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onDismiss}
          className="w-full mt-2 py-3 text-sm font-medium text-gray-500"
        >
          No thanks
        </button>
      </div>
    </div>
  )
}
