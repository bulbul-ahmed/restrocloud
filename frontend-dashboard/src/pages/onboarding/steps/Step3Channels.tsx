import { useState } from 'react'
import { ShoppingBag, Truck, QrCode, Globe, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { settingsApi } from '@/lib/settings.api'
import type { RestaurantSettings, OrderType } from '@/types/settings.types'

interface Channel {
  type: OrderType
  label: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
}

const CHANNELS: Channel[] = [
  {
    type: 'DINE_IN',
    label: 'Dine-in',
    description: 'Customers order at the table',
    icon: UtensilsCrossed,
    color: 'text-brand',
    bg: 'bg-orange-50',
  },
  {
    type: 'TAKEAWAY',
    label: 'Takeaway',
    description: 'Customers pick up their order',
    icon: ShoppingBag,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    type: 'DELIVERY',
    label: 'Delivery',
    description: 'Your drivers deliver to customers',
    icon: Truck,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
  {
    type: 'QR',
    label: 'QR Table Ordering',
    description: 'Scan QR code to order from table',
    icon: QrCode,
    color: 'text-violet-500',
    bg: 'bg-violet-50',
  },
  {
    type: 'ONLINE',
    label: 'Online Ordering',
    description: 'Orders from your online storefront',
    icon: Globe,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
  },
]

interface Props {
  restaurantId: string
  settings: RestaurantSettings
  onDone: () => void
  onSkip: () => void
}

export default function Step3Channels({ restaurantId, settings, onDone, onSkip }: Props) {
  const qc = useQueryClient()
  const [selected, setSelected]       = useState<Set<OrderType>>(new Set(settings.orderTypes ?? []))
  const [deliveryFee, setDeliveryFee] = useState(String(settings.deliveryFee ?? ''))
  const [minOrder, setMinOrder]       = useState(String(settings.minimumOrderAmount ?? ''))
  const [saving, setSaving]           = useState(false)

  function toggle(type: OrderType) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const hasDelivery = selected.has('DELIVERY')

  async function handleSave() {
    setSaving(true)
    try {
      const promises: Promise<unknown>[] = [
        settingsApi.updateOrderTypes(restaurantId, Array.from(selected)),
      ]
      if (hasDelivery) {
        promises.push(
          settingsApi.updateDeliverySettings(restaurantId, {
            deliveryFee: parseFloat(deliveryFee) || 0,
            minimumOrderAmount: parseFloat(minOrder) || 0,
          })
        )
      }
      await Promise.all(promises)
      qc.invalidateQueries({ queryKey: ['settings', restaurantId] })
      onDone()
    } catch {
      toast.error('Failed to save — try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Select the ordering channels your restaurant supports. You can change these anytime in Settings.
      </p>

      {/* Channel toggles */}
      <div className="space-y-2">
        {CHANNELS.map(({ type, label, description, icon: Icon, color, bg }) => {
          const active = selected.has(type)
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-brand bg-orange-50/50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  active ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                }`}
              >
                {active && (
                  <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Delivery settings — shown only when Delivery is selected */}
      {hasDelivery && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Delivery settings</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deliveryFee">Delivery fee</Label>
              <Input
                id="deliveryFee"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minOrder">Minimum order</Label>
              <Input
                id="minOrder"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">Values in your restaurant's currency. Set to 0 for free delivery / no minimum.</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip this step
        </button>
        <Button onClick={handleSave} loading={saving}>
          {selected.size === 0 ? 'Skip & Continue' : 'Save & Finish'}
        </Button>
      </div>
    </div>
  )
}
