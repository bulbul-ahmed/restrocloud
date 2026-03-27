'use client'
import { Plus } from 'lucide-react'
import { cn, fmtPrice } from '../../lib/utils'
import type { MenuItem } from '../../types/qr.types'

// Deterministic gradient per item name — avoids the generic 🍽️ placeholder
const GRADIENTS = [
  'from-orange-400 to-amber-300',
  'from-red-400 to-rose-300',
  'from-emerald-400 to-teal-300',
  'from-blue-400 to-cyan-300',
  'from-purple-400 to-violet-300',
  'from-pink-400 to-fuchsia-300',
  'from-yellow-400 to-orange-300',
  'from-green-400 to-emerald-300',
]
function itemGradient(name: string): string {
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

interface Props {
  item: MenuItem
  currency: string
  onPress: () => void
}

export function ItemCard({ item, currency, onPress }: Props) {
  const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price

  return (
    <button
      onClick={onPress}
      disabled={!item.isAvailable}
      className={cn(
        'w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden',
        'active:scale-[0.98] transition-transform duration-100',
        !item.isAvailable && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{item.name}</p>
          {item.description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">{item.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-brand font-bold text-sm">{fmtPrice(price, currency)}</span>
            {!item.isAvailable && (
              <span className="text-xs text-red-500 font-medium">Unavailable</span>
            )}
          </div>
          {item.dietaryTags && item.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.dietaryTags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image / Add button */}
        <div className="relative flex-shrink-0">
          {item.imageUrl ? (
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              {item.isAvailable && (
                <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center shadow">
                  <Plus size={14} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          ) : (
            <div className={cn('w-20 h-20 rounded-xl bg-gradient-to-br flex flex-col items-center justify-center gap-1', itemGradient(item.name))}>
              <span className="text-white font-bold text-2xl leading-none">
                {item.name[0]?.toUpperCase() ?? '?'}
              </span>
              {item.isAvailable && (
                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center">
                  <Plus size={14} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
