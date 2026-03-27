import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Building2,
  Clock,
  Receipt,
  ShoppingBag,
  Percent,
  Save,
  Plus,
  X,
  CheckSquare,
  CircleCheck,
  CreditCard,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { settingsApi } from '@/lib/settings.api'
import { useAuthStore } from '@/store/auth.store'
import { api, apiError } from '@/lib/api'
import { applyBrandColor } from '@/lib/theme'
import type { DayHours, OrderType, TipOptions, ReceiptConfig, AutoAcceptConfig, RestaurantSettings, PaymentGatewayConfig } from '@/types/settings.types'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'profile' | 'hours' | 'billing' | 'ordering' | 'receipt' | 'gateways' | 'system'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',  label: 'Profile',   icon: Building2    },
  { id: 'hours',    label: 'Hours',     icon: Clock        },
  { id: 'billing',  label: 'Billing',   icon: Percent      },
  { id: 'ordering', label: 'Ordering',  icon: ShoppingBag  },
  { id: 'receipt',  label: 'Receipt',   icon: Receipt      },
  { id: 'gateways', label: 'Gateways',  icon: CreditCard   },
  { id: 'system',   label: 'System',    icon: CircleCheck  },
]

const DAYS: { key: keyof NonNullable<NonNullable<RestaurantSettings['operatingHours']>['regularHours']>; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN:   'Dine In',
  TAKEAWAY:  'Takeaway',
  DELIVERY:  'Delivery',
  QR:        'QR Table',
  ONLINE:    'Online',
}

const ALL_ORDER_TYPES: OrderType[] = ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR', 'ONLINE']

const TIMEZONES = [
  'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore',
  'Asia/Tokyo', 'Asia/Bangkok', 'Europe/London', 'Europe/Paris', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'Africa/Nairobi', 'Australia/Sydney',
]

const CURRENCIES = [
  { code: 'BDT', label: 'BDT — Bangladeshi Taka' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:             z.string().min(1, 'Restaurant name is required'),
  description:      z.string().optional(),
  logoUrl:          z.string().optional(),
  logoWordmarkUrl:  z.string().optional(),
  brandColor:       z.string().optional(),
  phone:            z.string().optional(),
  email:            z.string().optional(),
  website:          z.string().optional(),
  address:          z.string().optional(),
  city:             z.string().optional(),
  country:          z.string().optional(),
  timezone:         z.string().min(1),
  locale:           z.string().min(1),
  currency:         z.string().min(1),
})

type ProfileForm = z.infer<typeof profileSchema>

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('profile')

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings', restaurantId],
    queryFn: () => settingsApi.get(restaurantId),
    enabled: !!restaurantId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError || !settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-sm text-gray-500">Failed to load settings.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['settings', restaurantId] })

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Restaurant Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your restaurant profile, hours, billing, and more.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-6 mt-4 border-b border-border flex-shrink-0 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-tab={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === 'profile'  && <ProfileTab  settings={settings} restaurantId={restaurantId} onSave={invalidate} />}
        {tab === 'hours'    && <HoursTab    settings={settings} restaurantId={restaurantId} onSave={invalidate} />}
        {tab === 'billing'  && <BillingTab  settings={settings} restaurantId={restaurantId} onSave={invalidate} />}
        {tab === 'ordering' && <OrderingTab settings={settings} restaurantId={restaurantId} onSave={invalidate} />}
        {tab === 'receipt'  && <ReceiptTab  settings={settings} restaurantId={restaurantId} onSave={invalidate} />}
        {tab === 'gateways' && <PaymentGatewaysTab restaurantId={restaurantId} />}
        {tab === 'system'   && <SystemTab />}
      </div>
    </div>
  )
}

// ─── Brand Color Picker ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: 'Orange',   value: '#ff6b35' },
  { label: 'Red',      value: '#e53e3e' },
  { label: 'Rose',     value: '#f43f5e' },
  { label: 'Purple',   value: '#7c3aed' },
  { label: 'Indigo',   value: '#4f46e5' },
  { label: 'Blue',     value: '#2563eb' },
  { label: 'Teal',     value: '#0d9488' },
  { label: 'Green',    value: '#16a34a' },
  { label: 'Amber',    value: '#d97706' },
  { label: 'Slate',    value: '#475569' },
]

function BrandColorPicker({ value, onChange, saving, error }: { value: string; onChange: (c: string) => void; saving?: boolean; error?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-medium text-gray-700">Brand Color</label>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Presets */}
        {PRESET_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            disabled={saving}
            onClick={() => onChange(c.value)}
            className={cn(
              'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
              value === c.value ? 'border-gray-800 scale-110' : 'border-transparent',
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
        {/* Native color input */}
        <label className="relative cursor-pointer" title="Custom color">
          <div
            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 transition-colors overflow-hidden"
            style={{ backgroundColor: PRESET_COLORS.some(c => c.value === value) ? 'transparent' : value }}
          >
            {PRESET_COLORS.some(c => c.value === value) && (
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            )}
          </div>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>
        {/* Hex display */}
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{value}</span>
        {/* Live preview pill */}
        <span className="text-xs px-3 py-1 rounded-full text-white font-medium" style={{ backgroundColor: value }}>
          Preview
        </span>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1.5">Click any color to apply instantly. Applied to buttons, links, and accents across the dashboard, QR menu, and online ordering.</p>
    </div>
  )
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ settings, restaurantId, onSave }: { settings: RestaurantSettings; restaurantId: string; onSave: () => void }) {
  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name:             settings.name,
      description:      settings.description ?? '',
      logoUrl:          settings.logoUrl ?? '',
      logoWordmarkUrl:  settings.logoWordmarkUrl ?? '',
      brandColor:       settings.brandColor ?? '#ff6b35',
      phone:       settings.phone ?? '',
      email:       settings.email ?? '',
      website:     settings.website ?? '',
      address:     settings.address ?? '',
      city:        settings.city ?? '',
      country:     settings.country ?? '',
      timezone:    settings.timezone ?? 'Asia/Dhaka',
      locale:      settings.locale ?? 'en',
      currency:    settings.currency ?? 'BDT',
    },
  })

  useEffect(() => {
    reset({
      name:             settings.name,
      description:      settings.description ?? '',
      logoUrl:          settings.logoUrl ?? '',
      logoWordmarkUrl:  settings.logoWordmarkUrl ?? '',
      brandColor:       settings.brandColor ?? '#ff6b35',
      phone:       settings.phone ?? '',
      email:       settings.email ?? '',
      website:     settings.website ?? '',
      address:     settings.address ?? '',
      city:        settings.city ?? '',
      country:     settings.country ?? '',
      timezone:    settings.timezone ?? 'Asia/Dhaka',
      locale:      settings.locale ?? 'en',
      currency:    settings.currency ?? 'BDT',
    })
  }, [settings, reset])

  const logoUrl = watch('logoUrl')
  const logoWordmarkUrl = watch('logoWordmarkUrl')
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wordmarkInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingWordmark, setUploadingWordmark] = useState(false)
  const [savingColor, setSavingColor] = useState(false)

  async function handleColorChange(color: string) {
    reset({ ...watch(), brandColor: color })
    applyBrandColor(color)
    setSavingColor(true)
    try {
      await settingsApi.updateProfile(restaurantId, { brandColor: color })
      qc.invalidateQueries({ queryKey: ['settings', restaurantId] })
      toast.success('Brand color saved')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSavingColor(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setUploading(true)
    try {
      const res = await api.post(`/restaurants/${restaurantId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url: string = res.data?.data?.logoUrl ?? res.data?.logoUrl
      reset({ ...watch(), logoUrl: url })
      qc.invalidateQueries({ queryKey: ['settings', restaurantId] })
      qc.invalidateQueries({ queryKey: ['sidebar-restaurant', restaurantId] })
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleWordmarkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    setUploadingWordmark(true)
    try {
      const res = await api.post(`/restaurants/${restaurantId}/logo-wordmark`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url: string = res.data?.data?.logoWordmarkUrl ?? res.data?.logoWordmarkUrl
      reset({ ...watch(), logoWordmarkUrl: url })
      qc.invalidateQueries({ queryKey: ['settings', restaurantId] })
      toast.success('Wordmark logo uploaded')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setUploadingWordmark(false)
      if (wordmarkInputRef.current) wordmarkInputRef.current.value = ''
    }
  }

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => {
      const clean: Record<string, string> = {}
      for (const [k, v] of Object.entries(data)) {
        if (v !== '') clean[k] = v as string
      }
      return settingsApi.updateProfile(restaurantId, clean)
    },
    onSuccess: () => { toast.success('Profile saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d), (errs) => toast.error('Please fix: ' + Object.values(errs).map((e) => e?.message).filter(Boolean).join(', ')))} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Icon logo upload */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Icon Logo <span className="text-gray-400 font-normal">(square)</span></label>
            <p className="text-xs text-gray-400 mb-2">Used in the sidebar, compact spots, and app icons. Best as a square image (e.g. 400×400 px).</p>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 flex-shrink-0">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                </div>
              )}
              <div className="space-y-1.5">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
                  {uploading ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg> Uploading…</>
                  ) : (
                    <>{logoUrl ? 'Change Icon Logo' : 'Upload Icon Logo'}</>
                  )}
                </button>
                <p className="text-xs text-gray-400">JPEG, PNG, WebP or SVG · max 2 MB</p>
              </div>
            </div>
          </div>

          {/* Wordmark logo upload */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Wordmark Logo <span className="text-gray-400 font-normal">(horizontal · optional)</span></label>
            <p className="text-xs text-gray-400 mb-2">Shown in the QR ordering header and online ordering hero. Use a wide/horizontal image (e.g. 800×200 px). Falls back to icon logo if not set.</p>
            <div className="flex items-center gap-4">
              {logoWordmarkUrl ? (
                <img
                  src={logoWordmarkUrl}
                  alt="Wordmark"
                  className="h-14 max-w-[200px] rounded-xl object-contain border border-gray-200 bg-gray-50 flex-shrink-0 px-2"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="h-14 w-48 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 flex-shrink-0">
                  <svg width="28" height="14" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 28 14"><rect x="1" y="1" width="26" height="12" rx="2"/><path d="M6 9L10 5l4 4 3-3 4 3"/></svg>
                </div>
              )}
              <div className="space-y-1.5">
                <input ref={wordmarkInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleWordmarkUpload} />
                <button type="button" onClick={() => wordmarkInputRef.current?.click()} disabled={uploadingWordmark}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors">
                  {uploadingWordmark ? (
                    <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg> Uploading…</>
                  ) : (
                    <>{logoWordmarkUrl ? 'Change Wordmark' : 'Upload Wordmark'}</>
                  )}
                </button>
                <p className="text-xs text-gray-400">JPEG, PNG, WebP or SVG · max 2 MB · wide format recommended</p>
              </div>
            </div>
          </div>

          <Field label="Restaurant Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Spice Garden" />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <textarea
              {...register('description')}
              placeholder="A short description of your restaurant..."
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </Field>

          {/* Brand color picker */}
          <BrandColorPicker
            value={watch('brandColor') ?? '#ff6b35'}
            onChange={handleColorChange}
            saving={savingColor}
            error={errors.brandColor?.message}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Phone" error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="+880 1700 000000" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input {...register('email')} placeholder="hello@restaurant.com" />
          </Field>
          <Field label="Website" error={errors.website?.message} className="col-span-2">
            <Input {...register('website')} placeholder="https://restaurant.com" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Address" error={errors.address?.message} className="col-span-2">
            <Input {...register('address')} placeholder="45 Gulshan Avenue" />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <Input {...register('city')} placeholder="Dhaka" />
          </Field>
          <Field label="Country" error={errors.country?.message}>
            <Input {...register('country')} placeholder="Bangladesh" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Locale & Currency</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <Field label="Timezone" error={errors.timezone?.message}>
            <select {...register('timezone')} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Locale" error={errors.locale?.message}>
            <select {...register('locale')} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              <option value="en">English (en)</option>
              <option value="bn">Bengali (bn)</option>
              <option value="ar">Arabic (ar)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="fr">French (fr)</option>
              <option value="es">Spanish (es)</option>
            </select>
          </Field>
          <Field label="Currency" error={errors.currency?.message}>
            <select {...register('currency')} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      <SaveBar isDirty={isDirty} saving={mutation.isPending} />
    </form>
  )
}

// ─── Hours Tab ───────────────────────────────────────────────────────────────

function HoursTab({ settings, restaurantId, onSave }: { settings: RestaurantSettings; restaurantId: string; onSave: () => void }) {
  const existing = (settings.operatingHours as any)?.regularHours ?? {}

  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const defaults: Record<string, DayHours> = {}
    DAYS.forEach(({ key }) => {
      defaults[key] = existing[key] ?? { closed: false, open: '09:00', close: '22:00' }
    })
    return defaults
  })

  useEffect(() => {
    const defaults: Record<string, DayHours> = {}
    DAYS.forEach(({ key }) => {
      defaults[key] = existing[key] ?? { closed: false, open: '09:00', close: '22:00' }
    })
    setHours(defaults)
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateHours(restaurantId, { regularHours: hours as any }),
    onSuccess: () => { toast.success('Operating hours saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  function setDay(key: string, partial: Partial<DayHours>) {
    setHours((h) => ({ ...h, [key]: { ...h[key], ...partial } }))
  }

  const tz = settings.timezone || 'UTC'
  const nowInTz = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date())

  return (
    <div className="max-w-2xl space-y-6">
      {/* Timezone banner */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-500"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>
          All hours are in <strong>{tz}</strong> — current time: <strong>{nowInTz}</strong>.
          {' '}To change timezone, go to <button type="button" className="underline hover:text-blue-600" onClick={() => (document.querySelector('[data-tab="profile"]') as HTMLElement)?.click()}>Profile settings</button>.
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Schedule</CardTitle>
          <CardDescription>Set your regular operating hours for each day of the week.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const day = hours[key] ?? { closed: false, open: '09:00', close: '22:00' }
            return (
              <div key={key} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="w-28 shrink-0">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setDay(key, { closed: !day.closed })}
                  className={cn(
                    'relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0',
                    day.closed ? 'bg-gray-200' : 'bg-brand',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    !day.closed && 'translate-x-4',
                  )} />
                </button>
                {day.closed ? (
                  <span className="text-sm text-gray-400 italic">Closed</span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={day.open ?? '09:00'}
                      onChange={(e) => setDay(key, { open: e.target.value })}
                      className="border border-input rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 w-28"
                    />
                    <span className="text-gray-400 text-sm">–</span>
                    <input
                      type="time"
                      value={day.close ?? '22:00'}
                      onChange={(e) => setDay(key, { close: e.target.value })}
                      className="border border-input rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 w-28"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-brand hover:bg-brand/90">
        {mutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Hours</>}
      </Button>
    </div>
  )
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab({ settings, restaurantId, onSave }: { settings: RestaurantSettings; restaurantId: string; onSave: () => void }) {
  const [taxRate, setTaxRate] = useState(Number(settings.taxRate))
  const [taxInclusive, setTaxInclusive] = useState(settings.taxInclusive)
  const [serviceCharge, setServiceCharge] = useState(Number(settings.serviceCharge))
  const [deliveryFee, setDeliveryFee] = useState(Number(settings.deliveryFee ?? 0))
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(Number(settings.minimumOrderAmount ?? 0))

  useEffect(() => {
    setTaxRate(Number(settings.taxRate))
    setTaxInclusive(settings.taxInclusive)
    setServiceCharge(Number(settings.serviceCharge))
    setDeliveryFee(Number(settings.deliveryFee ?? 0))
    setMinimumOrderAmount(Number(settings.minimumOrderAmount ?? 0))
  }, [settings])

  const taxMutation = useMutation({
    mutationFn: () => settingsApi.updateTax(restaurantId, { taxRate, taxInclusive }),
    onSuccess: () => { toast.success('Tax settings saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  const scMutation = useMutation({
    mutationFn: () => settingsApi.updateServiceCharge(restaurantId, serviceCharge),
    onSuccess: () => { toast.success('Service charge saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  const deliveryMutation = useMutation({
    mutationFn: () => settingsApi.updateDeliverySettings(restaurantId, { deliveryFee, minimumOrderAmount }),
    onSuccess: () => { toast.success('Delivery settings saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax Configuration</CardTitle>
          <CardDescription>Set your VAT / GST rate and how it applies to prices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-end gap-4">
            <Field label="Tax Rate (%)" className="w-40">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </Field>
            <div className="flex items-center gap-2 pb-2">
              <span className="text-sm text-gray-600">0% = Tax disabled</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Tax Inclusive Pricing</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {taxInclusive
                  ? 'Prices shown already include tax — no extra charge at checkout'
                  : 'Tax is added on top of item prices at checkout'}
              </p>
            </div>
            <Toggle value={taxInclusive} onChange={setTaxInclusive} />
          </div>

          {/* Preview */}
          {taxRate > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Example: ৳100 item at {taxRate}% tax</p>
              {taxInclusive ? (
                <p>Item price: ৳100 (tax included) → Customer pays ৳100</p>
              ) : (
                <p>Item price: ৳100 + tax ৳{(taxRate).toFixed(2)} → Customer pays ৳{(100 + taxRate).toFixed(2)}</p>
              )}
            </div>
          )}

          <Button onClick={() => taxMutation.mutate()} disabled={taxMutation.isPending} className="bg-brand hover:bg-brand/90">
            {taxMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Tax Settings</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service Charge</CardTitle>
          <CardDescription>Applied as a percentage of the order subtotal. Set to 0 to disable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Service Charge (%)" className="w-40">
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={serviceCharge}
                onChange={(e) => setServiceCharge(Number(e.target.value))}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </Field>
          <Button onClick={() => scMutation.mutate()} disabled={scMutation.isPending} className="bg-brand hover:bg-brand/90">
            {scMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Service Charge</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Settings</CardTitle>
          <CardDescription>Configure delivery fee and minimum order amount for online orders. Set to 0 to disable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={`Delivery Fee (${settings.currency})`}>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value))}
                placeholder="0 = Free delivery"
              />
            </Field>
            <Field label={`Minimum Order Amount (${settings.currency})`}>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={minimumOrderAmount}
                onChange={(e) => setMinimumOrderAmount(Number(e.target.value))}
                placeholder="0 = No minimum"
              />
            </Field>
          </div>
          {(deliveryFee > 0 || minimumOrderAmount > 0) && (
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
              {deliveryFee > 0 && <p>Customers will be charged <strong>{settings.currency} {deliveryFee}</strong> for delivery orders.</p>}
              {minimumOrderAmount > 0 && <p>Orders below <strong>{settings.currency} {minimumOrderAmount}</strong> cannot be placed for delivery.</p>}
            </div>
          )}
          <Button onClick={() => deliveryMutation.mutate()} disabled={deliveryMutation.isPending} className="bg-brand hover:bg-brand/90">
            {deliveryMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Delivery Settings</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Ordering Tab ────────────────────────────────────────────────────────────

function OrderingTab({ settings, restaurantId, onSave }: { settings: RestaurantSettings; restaurantId: string; onSave: () => void }) {
  const [orderTypes, setOrderTypes] = useState<OrderType[]>(settings.orderTypes ?? ['DINE_IN'])
  const [tipPercentages, setTipPercentages] = useState<number[]>(
    (settings.tipOptions as TipOptions)?.tipPercentages ?? [10, 15, 20],
  )
  const [allowCustomTip, setAllowCustomTip] = useState<boolean>(
    (settings.tipOptions as TipOptions)?.allowCustom ?? true,
  )
  const autoAcceptData = (settings.autoAccept as AutoAcceptConfig) ?? {}
  const [autoAccept, setAutoAccept] = useState<AutoAcceptConfig>(autoAcceptData)
  const [newTip, setNewTip] = useState('')
  const [qrBaseUrl, setQrBaseUrl] = useState(settings.qrBaseUrl ?? '')

  useEffect(() => {
    setOrderTypes(settings.orderTypes ?? ['DINE_IN'])
    setTipPercentages((settings.tipOptions as TipOptions)?.tipPercentages ?? [10, 15, 20])
    setAllowCustomTip((settings.tipOptions as TipOptions)?.allowCustom ?? true)
    setAutoAccept((settings.autoAccept as AutoAcceptConfig) ?? {})
    setQrBaseUrl(settings.qrBaseUrl ?? '')
  }, [settings])

  const orderTypesMutation = useMutation({
    mutationFn: () => settingsApi.updateOrderTypes(restaurantId, orderTypes),
    onSuccess: () => { toast.success('Order types saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  const tipsMutation = useMutation({
    mutationFn: () =>
      settingsApi.updateTipOptions(restaurantId, {
        tipPercentages: [...tipPercentages].sort((a, b) => a - b),
        allowCustom: allowCustomTip,
      }),
    onSuccess: () => { toast.success('Tip options saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  const autoAcceptMutation = useMutation({
    mutationFn: () => settingsApi.updateAutoAccept(restaurantId, autoAccept),
    onSuccess: () => { toast.success('Auto-accept settings saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  const qrBaseUrlMutation = useMutation({
    mutationFn: () => settingsApi.updateQrBaseUrl(restaurantId, qrBaseUrl.trim() || null),
    onSuccess: () => { toast.success('QR base URL saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  function toggleOrderType(ot: OrderType) {
    if (orderTypes.includes(ot)) {
      if (orderTypes.length === 1) { toast.error('At least one order type must be enabled'); return }
      setOrderTypes(orderTypes.filter((t) => t !== ot))
    } else {
      setOrderTypes([...orderTypes, ot])
    }
  }

  function addTip() {
    const val = parseInt(newTip)
    if (isNaN(val) || val < 1 || val > 100) { toast.error('Enter a value between 1–100'); return }
    if (tipPercentages.includes(val)) { toast.error('Already added'); return }
    if (tipPercentages.length >= 5) { toast.error('Max 5 tip options'); return }
    setTipPercentages([...tipPercentages, val])
    setNewTip('')
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Order Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Channels</CardTitle>
          <CardDescription>Enable the ordering channels your restaurant accepts. At least one required.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {ALL_ORDER_TYPES.map((ot) => {
              const active = orderTypes.includes(ot)
              return (
                <button
                  key={ot}
                  type="button"
                  onClick={() => toggleOrderType(ot)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors',
                    active
                      ? 'border-brand bg-orange-50 text-brand'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                  )}
                >
                  <CheckSquare size={16} className={active ? 'text-brand' : 'text-gray-300'} />
                  <span className="text-sm font-medium">{ORDER_TYPE_LABELS[ot]}</span>
                </button>
              )
            })}
          </div>
          <Button
            className="mt-4 bg-brand hover:bg-brand/90"
            onClick={() => orderTypesMutation.mutate()}
            disabled={orderTypesMutation.isPending}
          >
            {orderTypesMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Order Channels</>}
          </Button>
        </CardContent>
      </Card>

      {/* Tip Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tip Options</CardTitle>
          <CardDescription>Suggested tip percentages shown at checkout (max 5).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tipPercentages.map((pct) => (
              <span key={pct} className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-full px-3 py-1 text-sm font-medium">
                {pct}%
                <button type="button" onClick={() => setTipPercentages(tipPercentages.filter((t) => t !== pct))}>
                  <X size={12} className="hover:text-red-500" />
                </button>
              </span>
            ))}
            {tipPercentages.length < 5 && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={newTip}
                  onChange={(e) => setNewTip(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTip() } }}
                  placeholder="%"
                  className="w-16 border border-input rounded-full px-3 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <button type="button" onClick={addTip} className="w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center">
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-900">Allow Custom Tip</p>
              <p className="text-xs text-gray-500 mt-0.5">Let customers enter a custom tip amount</p>
            </div>
            <Toggle value={allowCustomTip} onChange={setAllowCustomTip} />
          </div>

          <Button
            className="bg-brand hover:bg-brand/90"
            onClick={() => tipsMutation.mutate()}
            disabled={tipsMutation.isPending}
          >
            {tipsMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Tip Options</>}
          </Button>
        </CardContent>
      </Card>

      {/* Auto-Accept */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Accept Orders</CardTitle>
          <CardDescription>
            When enabled for a channel, incoming orders are automatically accepted — no manual confirmation needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              { key: 'pos',        label: 'POS Orders',        desc: 'Orders created by staff at the POS terminal' },
              { key: 'qr',         label: 'QR Table Orders',   desc: 'Orders placed by customers via QR code scan' },
              { key: 'online',     label: 'Online Orders',     desc: 'Orders from your online ordering website' },
              { key: 'aggregator', label: 'Aggregator Orders', desc: 'Orders from Foodpanda, Pathao, etc.' },
            ] as { key: keyof AutoAcceptConfig; label: string; desc: string }[]
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <Toggle
                value={autoAccept[key] ?? false}
                onChange={(v) => setAutoAccept({ ...autoAccept, [key]: v })}
              />
            </div>
          ))}
          <Button
            className="bg-brand hover:bg-brand/90"
            onClick={() => autoAcceptMutation.mutate()}
            disabled={autoAcceptMutation.isPending}
          >
            {autoAcceptMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Auto-Accept</>}
          </Button>
        </CardContent>
      </Card>

      {/* QR Base URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR Table Ordering URL</CardTitle>
          <CardDescription>
            The base URL encoded into table QR codes. Customers are sent to{' '}
            <span className="font-mono text-xs">{(qrBaseUrl.trim() || 'https://order.restrocloud.com').replace(/\/$/, '')}/table/&#123;restaurantId&#125;/&#123;tableId&#125;</span>.
            Leave blank to use the default RestroCloud ordering domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qrBaseUrl">Base URL</Label>
            <Input
              id="qrBaseUrl"
              placeholder="https://order.restrocloud.com"
              value={qrBaseUrl}
              onChange={(e) => setQrBaseUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-400">
              Use your own domain (e.g. <span className="font-mono">https://order.myrestaurant.com</span>) or leave blank for the default.
              You must regenerate all table QR codes after changing this.
            </p>
          </div>
          <Button
            className="bg-brand hover:bg-brand/90"
            onClick={() => qrBaseUrlMutation.mutate()}
            disabled={qrBaseUrlMutation.isPending}
          >
            {qrBaseUrlMutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save QR URL</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Receipt Tab ─────────────────────────────────────────────────────────────

function ReceiptTab({ settings, restaurantId, onSave }: { settings: RestaurantSettings; restaurantId: string; onSave: () => void }) {
  const rc = (settings.receiptConfig as ReceiptConfig) ?? {}
  const [header, setHeader] = useState(rc.header ?? '')
  const [footer, setFooter] = useState(rc.footer ?? '')
  const [showLogo, setShowLogo] = useState(rc.showLogo ?? true)
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(rc.showTaxBreakdown ?? true)
  const [showWifi, setShowWifi] = useState(rc.showWifi ?? false)
  const [wifiPassword, setWifiPassword] = useState(rc.wifiPassword ?? '')

  useEffect(() => {
    const r = (settings.receiptConfig as ReceiptConfig) ?? {}
    setHeader(r.header ?? '')
    setFooter(r.footer ?? '')
    setShowLogo(r.showLogo ?? true)
    setShowTaxBreakdown(r.showTaxBreakdown ?? true)
    setShowWifi(r.showWifi ?? false)
    setWifiPassword(r.wifiPassword ?? '')
  }, [settings])

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateReceipt(restaurantId, {
        header: header || undefined,
        footer: footer || undefined,
        showLogo,
        showTaxBreakdown,
        showWifi,
        wifiPassword: showWifi ? wifiPassword : undefined,
      }),
    onSuccess: () => { toast.success('Receipt config saved'); onSave() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt Text</CardTitle>
          <CardDescription>Custom text printed at the top and bottom of every receipt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Header (top of receipt)">
            <textarea
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder={`${settings.name}\n${settings.address ?? ''}`}
              maxLength={200}
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <p className="text-xs text-gray-400 mt-1">{header.length}/200 characters</p>
          </Field>
          <Field label="Footer (bottom of receipt)">
            <textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Thank you for dining with us! Follow us @restaurant"
              maxLength={200}
              rows={3}
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <p className="text-xs text-gray-400 mt-1">{footer.length}/200 characters</p>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Display Options</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Show restaurant logo', desc: 'Print your logo at the top of receipts', value: showLogo, onChange: setShowLogo },
            { label: 'Show tax breakdown', desc: 'Itemize tax amount on receipts', value: showTaxBreakdown, onChange: setShowTaxBreakdown },
            { label: 'Show Wi-Fi password', desc: 'Print your Wi-Fi password on receipts', value: showWifi, onChange: setShowWifi },
          ].map(({ label, desc, value, onChange }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <Toggle value={value} onChange={onChange} />
            </div>
          ))}

          {showWifi && (
            <Field label="Wi-Fi Password">
              <Input
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="yourwifipassword"
                maxLength={100}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {/* Receipt Preview */}
      <Card className="bg-gray-50 border-dashed">
        <CardHeader><CardTitle className="text-base text-gray-500">Receipt Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-700 space-y-2 max-w-xs mx-auto">
            {showLogo && settings.logoUrl && (
              <div className="text-center mb-2">
                <img src={settings.logoUrl} alt="logo" className="h-8 inline-block" />
              </div>
            )}
            {header ? (
              <pre className="whitespace-pre-wrap text-center">{header}</pre>
            ) : (
              <p className="text-center font-bold">{settings.name}</p>
            )}
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p>Chicken Biryani x2 ........ ৳480</p>
            <p>Raita x1 .................. ৳60</p>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <p>Subtotal .................. ৳540</p>
            {showTaxBreakdown && <p>VAT ({settings.taxRate}%) .............. ৳{(Number(settings.taxRate) * 5.4).toFixed(0)}</p>}
            <p className="font-bold">TOTAL .................... ৳{(540 + (showTaxBreakdown ? Number(settings.taxRate) * 5.4 : 0)).toFixed(0)}</p>
            <div className="border-t border-dashed border-gray-300 my-2" />
            {footer ? (
              <pre className="whitespace-pre-wrap text-center text-gray-400">{footer}</pre>
            ) : (
              <p className="text-center text-gray-400">Thank you for your visit!</p>
            )}
            {showWifi && wifiPassword && (
              <p className="text-center text-gray-400">Wi-Fi: {wifiPassword}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-brand hover:bg-brand/90">
        {mutation.isPending ? 'Saving…' : <><Save size={14} className="mr-2" />Save Receipt Config</>}
      </Button>
    </div>
  )
}

// ─── System Tab ──────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'M0',  name: 'Platform Foundation',      status: 'live' },
  { id: 'M1',  name: 'Auth & User Management',   status: 'live' },
  { id: 'M2',  name: 'Restaurant Configuration', status: 'live' },
  { id: 'M3',  name: 'Menu Management',          status: 'live' },
  { id: 'M4',  name: 'Order Engine',             status: 'live' },
  { id: 'M5',  name: 'Point of Sale',            status: 'live' },
  { id: 'M6',  name: 'Kitchen Display',          status: 'live' },
  { id: 'M7',  name: 'Table Management',         status: 'live' },
  { id: 'M8',  name: 'Payment Processing',       status: 'live' },
  { id: 'M9',  name: 'Analytics & Dashboard',    status: 'live' },
  { id: 'M10', name: 'Super Admin Panel',        status: 'live' },
  { id: 'M11', name: 'Notifications',            status: 'live' },
  { id: 'M12', name: 'QR Table Ordering',        status: 'live' },
  { id: 'M13', name: 'Online Ordering',          status: 'live' },
  { id: 'M14', name: 'Online Payments',          status: 'live' },
  { id: 'M15', name: 'Customer Accounts',        status: 'live' },
  { id: 'M16', name: 'Enhanced Order Mgmt',      status: 'live' },
  { id: 'M17', name: 'Aggregator Hub',           status: 'live' },
  { id: 'M18', name: 'Delivery Management',      status: 'live' },
  { id: 'M19', name: 'Reporting & Analytics',    status: 'live' },
  { id: 'M20', name: 'Inventory & Stock',        status: 'live' },
  { id: 'M21', name: 'CRM & Customer Loyalty',   status: 'live' },
  { id: 'M22', name: 'Staff & HR',               status: 'live' },
  { id: 'M24', name: 'Multi-Location',           status: 'live' },
  { id: 'M25', name: 'White-Label Mobile App',   status: 'planned' },
  { id: 'M26', name: 'Self-Service Kiosk',       status: 'planned' },
  { id: 'M27', name: 'Advanced Analytics & AI',  status: 'planned' },
]

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-gray-700 truncate">
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// ─── Payment Gateways Tab ────────────────────────────────────────────────────

const GATEWAYS = [
  { id: 'STRIPE',     label: 'Stripe',      logo: '💳', desc: 'International cards — Visa, Mastercard, Amex' },
  { id: 'BKASH',      label: 'bKash',       logo: '📱', desc: 'Mobile banking — most popular in Bangladesh'  },
  { id: 'SSLCOMMERZ', label: 'SSLCommerz',  logo: '🏦', desc: 'Local payment gateway — cards + MFS'         },
]

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function GatewayCard({
  gw,
  config,
  restaurantId,
  onSaved,
}: {
  gw: typeof GATEWAYS[0]
  config: PaymentGatewayConfig | undefined
  restaurantId: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [isLive, setIsLive] = useState(config?.isLive ?? false)
  const [isActive, setIsActive] = useState(config?.isActive ?? true)

  const isConfigured = !!config

  const saveMutation = useMutation({
    mutationFn: () =>
      settingsApi.upsertPaymentGateway(restaurantId, gw.id, {
        ...(apiKey        ? { apiKey }        : {}),
        ...(secretKey     ? { secretKey }     : {}),
        ...(webhookSecret ? { webhookSecret } : {}),
        isLive,
        isActive,
      }),
    onSuccess: () => { toast.success(`${gw.label} credentials saved`); setOpen(false); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Card className={cn('transition-all', isConfigured && isActive ? 'border-emerald-200' : '')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{gw.logo}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900 text-sm">{gw.label}</p>
                {isConfigured && (
                  <Badge variant={isActive ? 'success' : 'secondary'} className="text-2xs">
                    {isActive ? (config.isLive ? 'Live' : 'Test') : 'Disabled'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{gw.desc}</p>
              {isConfigured && (
                <p className="text-2xs text-gray-400 mt-1 font-mono">
                  API key: {config.apiKey ?? '—'} &nbsp;·&nbsp; Secret: {config.secretKey ?? '—'}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" variant={isConfigured ? 'outline' : 'default'} onClick={() => setOpen((o) => !o)}>
            {isConfigured ? 'Edit' : 'Configure'}
          </Button>
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">API Key / Public Key</Label>
                <SecretInput value={apiKey} onChange={setApiKey} placeholder={config?.apiKey ?? 'pk_live_…'} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Secret Key</Label>
                <SecretInput value={secretKey} onChange={setSecretKey} placeholder={config?.secretKey ?? 'sk_live_…'} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook Secret</Label>
              <SecretInput value={webhookSecret} onChange={setWebhookSecret} placeholder={config?.webhookSecret ?? 'whsec_…'} />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLive}
                  onChange={(e) => setIsLive(e.target.checked)}
                  className="w-4 h-4 accent-brand"
                />
                <span className="text-sm text-gray-700">Live mode</span>
                {isLive && <Badge variant="destructive" className="text-2xs">Live payments</Badge>}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-brand"
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                <Save size={13} />
                Save Credentials
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentGatewaysTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['settings', 'payment-gateways', restaurantId],
    queryFn: () => settingsApi.listPaymentGateways(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['settings', 'payment-gateways', restaurantId] })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Payment Gateways</h3>
        <p className="text-sm text-gray-500 mt-1">
          Enter your live API credentials for each payment gateway. Keys are stored securely and never shown in full after saving.
        </p>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        ⚠ Switch to <strong>Live mode</strong> only when you are ready to accept real payments. Test mode uses sandbox credentials that do not charge customers.
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <RefreshCw size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {GATEWAYS.map((gw) => (
            <GatewayCard
              key={gw.id}
              gw={gw}
              config={configs.find((c) => c.gateway === gw.id)}
              restaurantId={restaurantId}
              onSaved={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── System Tab ───────────────────────────────────────────────────────────────

function SystemTab() {
  const { user } = useAuthStore()
  const live    = MODULES.filter((m) => m.status === 'live').length
  const planned = MODULES.filter((m) => m.status === 'planned').length

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Identifiers</CardTitle>
          <CardDescription>Use these IDs when working with the API or contacting support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.restaurantId && <CopyField label="Restaurant ID" value={user.restaurantId} />}
          {user?.tenantId     && <CopyField label="Tenant ID"     value={user.tenantId} />}
          {user?.id           && <CopyField label="User ID"       value={user.id} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform Status</CardTitle>
          <CardDescription>
            {live} modules live · {planned} planned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
            {MODULES.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-gray-400 w-8 shrink-0">{mod.id}</span>
                  <span className="text-sm text-gray-700 truncate">{mod.name}</span>
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  mod.status === 'live'
                    ? 'bg-emerald-100 text-emerald-700'
                    : mod.status === 'building'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {mod.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0',
        value ? 'bg-brand' : 'bg-gray-200',
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
        value && 'translate-x-5',
      )} />
    </button>
  )
}

function SaveBar({ isDirty, saving }: { isDirty: boolean; saving: boolean }) {
  if (!isDirty && !saving) return null
  return (
    <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
      <p className="text-sm text-orange-700 flex-1">You have unsaved changes.</p>
      <Button type="submit" disabled={saving} size="sm" className="bg-brand hover:bg-brand/90">
        {saving ? 'Saving…' : <><Save size={13} className="mr-1.5" />Save Profile</>}
      </Button>
    </div>
  )
}
