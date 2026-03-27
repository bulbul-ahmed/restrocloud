import { useState } from 'react'
import { Globe, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { settingsApi } from '@/lib/settings.api'
import type { RestaurantSettings } from '@/types/settings.types'

// Common timezones grouped by region
const TIMEZONES = [
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Jakarta',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Australia/Sydney',
  'Pacific/Auckland',
]

const CURRENCIES = [
  { code: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'LKR', label: 'LKR — Sri Lankan Rupee' },
  { code: 'NPR', label: 'NPR — Nepalese Rupee' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
]

interface Props {
  restaurantId: string
  settings: RestaurantSettings
  onDone: () => void
  onSkip: () => void
}

export default function Step2Config({ restaurantId, settings, onDone, onSkip }: Props) {
  const qc = useQueryClient()
  const [timezone, setTimezone]       = useState(settings.timezone ?? 'Asia/Dhaka')
  const [currency, setCurrency]       = useState(settings.currency ?? 'BDT')
  const [taxRate, setTaxRate]         = useState(String(settings.taxRate ?? 0))
  const [taxInclusive, setTaxInclusive] = useState(settings.taxInclusive ?? false)
  const [serviceCharge, setServiceCharge] = useState(String(settings.serviceCharge ?? 0))
  const [saving, setSaving]           = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        settingsApi.updateProfile(restaurantId, { timezone, currency }),
        settingsApi.updateTax(restaurantId, {
          taxRate: parseFloat(taxRate) || 0,
          taxInclusive,
        }),
        settingsApi.updateServiceCharge(restaurantId, parseFloat(serviceCharge) || 0),
      ])
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
      {/* Timezone + Currency */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Globe size={15} className="text-brand" />
          Locale & Time
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tax */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Percent size={15} className="text-brand" />
          Tax & Charges
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="taxRate">Tax rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serviceCharge">Service charge (%)</Label>
            <Input
              id="serviceCharge"
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
              value={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Tax inclusive pricing</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {taxInclusive ? 'Prices already include tax' : 'Tax added on top of item prices'}
            </p>
          </div>
          <Switch
            checked={taxInclusive}
            onCheckedChange={setTaxInclusive}
          />
        </div>
      </div>

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
          Save & Continue
        </Button>
      </div>
    </div>
  )
}
