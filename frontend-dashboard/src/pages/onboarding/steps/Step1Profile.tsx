import { useState, useRef } from 'react'
import { Upload, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { settingsApi } from '@/lib/settings.api'
import { api } from '@/lib/api'
import type { RestaurantSettings } from '@/types/settings.types'

interface Props {
  restaurantId: string
  settings: RestaurantSettings
  onDone: () => void
  onSkip: () => void
}

export default function Step1Profile({ restaurantId, settings, onDone, onSkip }: Props) {
  const qc = useQueryClient()
  const [address, setAddress]     = useState(settings.address ?? '')
  const [city, setCity]           = useState(settings.city ?? '')
  const [country, setCountry]     = useState(settings.country ?? '')
  const [phone, setPhone]         = useState(settings.phone ?? '')
  const [description, setDescription] = useState(settings.description ?? '')
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl ?? null)
  const [saving, setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
    const formData = new FormData()
    formData.append('logo', file)
    try {
      await api.post(`/restaurants/${restaurantId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Logo uploaded')
    } catch {
      toast.error('Logo upload failed — you can retry in Settings')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await settingsApi.updateProfile(restaurantId, { address, city, country, phone, description })
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
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-brand transition-colors overflow-hidden bg-gray-50 shrink-0"
        >
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <Upload size={20} />
              <span className="text-[10px]">Logo</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-sm font-medium text-brand hover:underline"
          >
            Upload restaurant logo
          </button>
          <p className="text-xs text-gray-400 mt-0.5">PNG or JPG, max 5 MB (optional)</p>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Building2 size={15} className="text-brand" />
          Restaurant Location
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              placeholder="123 Main Street"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Dhaka"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="Bangladesh"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">
          Phone number <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+8801712345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description / cuisine type <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Authentic Bengali cuisine with a modern twist…"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
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
