import { useEffect, useState, useCallback } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Eye, Copy, Check,
  Flag, FlagOff, Coins, CalendarClock, Trash2, UserCog,
  StickyNote, Plus, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  listTenants, getTenantDetail, suspendTenant, activateTenant, updateTenantPlan,
  impersonateTenant, applyCredit, extendTrial, terminateTenant,
  flagTenant, unflagTenant, listNotes, createNote, deleteNote,
  assignManager, listSuperAdmins, createRestaurantManual, sendPasswordReset, updateRestaurantBrand,
} from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import type {
  TenantRow, TenantDetail, TenantNote, PlanTier, ImpersonateResult, SuperAdminUserRow,
  CreateRestaurantResult,
} from '@/types/superadmin.types'

// ─── Phone utilities ──────────────────────────────────────────────────────────

const DIAL_CODES: Record<string, string> = {
  BD: '+880', IN: '+91', US: '+1', GB: '+44',
  AE: '+971', SA: '+966', MY: '+60', SG: '+65',
}

// Detect user's country from browser timezone, fall back to 'BD'
function detectCountryFromBrowser(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const tzMap: Record<string, string> = {
      'Asia/Dhaka': 'BD',
      'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
      'America/New_York': 'US', 'America/Los_Angeles': 'US',
      'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US',
      'Europe/London': 'GB',
      'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA',
      'Asia/Kuala_Lumpur': 'MY',
      'Asia/Singapore': 'SG',
    }
    return tzMap[tz] ?? 'BD'
  } catch {
    return 'BD'
  }
}

function dialCode(country: string): string {
  return DIAL_CODES[country] ?? DIAL_CODES[detectCountryFromBrowser()] ?? '+880'
}

// A phone value is "prefix only" (safe to auto-replace when country changes)
function isPrefixOnly(v: string): boolean {
  return v === '' || Object.values(DIAL_CODES).includes(v)
}

function isValidPhone(v: string) {
  return v === '' || /^\+[1-9]\d{6,14}$/.test(v)
}

function normalisePhone(raw: string): string {
  let cleaned = raw.replace(/[^\d+]/g, '')
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned.replace(/\+/g, '')
  else cleaned = '+' + cleaned.slice(1).replace(/\+/g, '')
  return '+' + cleaned.slice(1).slice(0, 15)
}

interface PhoneInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}

function PhoneInput({ value, onChange, placeholder = '+1 555 000 0000', id }: PhoneInputProps) {
  const [touched, setTouched] = useState(false)
  const invalid = touched && !isValidPhone(value)

  return (
    <div className="space-y-1">
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(normalisePhone(e.target.value))}
        onBlur={() => setTouched(true)}
        className={`w-full h-9 rounded-md border bg-background px-3 text-sm outline-none transition-colors
          ${invalid
            ? 'border-red-400 focus:border-red-500 text-red-700'
            : 'border-input focus:border-brand'
          }`}
      />
      {invalid && (
        <p className="text-xs text-red-500">
          Enter a valid international number (e.g. +8801711234567)
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const PLANS: PlanTier[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE']

function planVariant(plan: PlanTier) {
  if (plan === 'ENTERPRISE') return 'default' as const
  if (plan === 'PROFESSIONAL') return 'info' as const
  return 'secondary' as const
}

const SA_PRESET_COLORS = [
  '#ff6b35', '#e53e3e', '#f43f5e', '#7c3aed',
  '#4f46e5', '#2563eb', '#0d9488', '#16a34a', '#d97706', '#475569',
]

function RestaurantBrandRow({
  restaurant, tenantId, onUpdated,
}: {
  restaurant: { id: string; name: string; isActive: boolean; brandColor?: string | null }
  tenantId: string
  onUpdated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const current = restaurant.brandColor ?? '#ff6b35'

  async function handleColorChange(color: string) {
    setSaving(true)
    try {
      await updateRestaurantBrand(tenantId, restaurant.id, color)
      toast.success(`Brand color updated for ${restaurant.name}`)
      onUpdated()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{restaurant.name}</p>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{restaurant.id.slice(0, 8)}…</p>
        </div>
        <Badge variant={restaurant.isActive ? 'success' : 'secondary'} className="flex-shrink-0">
          {restaurant.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Brand Color</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SA_PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={saving}
              onClick={() => handleColorChange(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-50 ${current === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <label className="relative cursor-pointer" title="Custom color">
            <div
              className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 overflow-hidden"
              style={{ backgroundColor: SA_PRESET_COLORS.includes(current) ? 'transparent' : current }}
            >
              {SA_PRESET_COLORS.includes(current) && <span className="text-[10px] font-bold">+</span>}
            </div>
            <input
              type="color"
              value={current}
              onChange={(e) => handleColorChange(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <span className="text-[11px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
            {current}
          </span>
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
        </div>
      </div>
    </div>
  )
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState<PlanTier | ''>('')
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<'overview' | 'notes'>('overview')
  const [notes, setNotes] = useState<TenantNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // Impersonate dialog
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [impersonateResult, setImpersonateResult] = useState<ImpersonateResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [impersonateTenantId, setImpersonateTenantId] = useState('')
  const [impersonateRestaurantId, setImpersonateRestaurantId] = useState('')
  const [impersonateLoading, setImpersonateLoading] = useState(false)

  // Credit dialog
  const [creditOpen, setCreditOpen] = useState(false)
  const [creditTenant, setCreditTenant] = useState<TenantRow | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)

  // Extend trial dialog
  const [trialOpen, setTrialOpen] = useState(false)
  const [trialTenant, setTrialTenant] = useState<TenantRow | null>(null)
  const [trialDays, setTrialDays] = useState('14')
  const [trialLoading, setTrialLoading] = useState(false)

  // Terminate confirm dialog
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [terminateTenantRow, setTerminateTenantRow] = useState<TenantRow | null>(null)
  const [terminateLoading, setTerminateLoading] = useState(false)

  // Password reset
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null)

  async function handleSendPasswordReset(tenantId: string, userId: string, email: string) {
    setResetLoadingId(userId)
    try {
      await sendPasswordReset(tenantId, userId)
      toast.success(`Reset email sent to ${email}`)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setResetLoadingId(null)
    }
  }

  // Assign manager dialog
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerTenant, setManagerTenant] = useState<TenantRow | null>(null)
  const [admins, setAdmins] = useState<SuperAdminUserRow[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')
  const [managerLoading, setManagerLoading] = useState(false)

  // Create restaurant dialog
  const EMPTY_FORM = {
    ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerPhone: '',
    restaurantName: '', country: 'BD', city: '', address: '',
    restaurantPhone: '', restaurantEmail: '',
    plan: 'STARTER' as PlanTier, trialDays: '14',
    internalNotes: '', sendWelcomeEmail: true,
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createLoading, setCreateLoading] = useState(false)
  const [createResult, setCreateResult] = useState<CreateRestaurantResult | null>(null)
  const [credCopied, setCredCopied] = useState(false)

  function setField(key: keyof typeof EMPTY_FORM, value: string | boolean) {
    setCreateForm((f) => ({ ...f, [key]: value }))
  }

  async function handleCreateRestaurant() {
    setCreateLoading(true)
    try {
      const result = await createRestaurantManual({
        ...createForm,
        ownerPhone: createForm.ownerPhone || undefined,
        city: createForm.city || undefined,
        address: createForm.address || undefined,
        restaurantPhone: createForm.restaurantPhone || undefined,
        restaurantEmail: createForm.restaurantEmail || undefined,
        internalNotes: createForm.internalNotes || undefined,
        trialDays: Number(createForm.trialDays),
      })
      setCreateResult(result)
      load() // refresh tenant list
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setCreateLoading(false)
    }
  }

  function closeCreateDialog() {
    setCreateOpen(false)
    setCreateResult(null)
    setCreateForm(EMPTY_FORM)
    setCredCopied(false)
  }

  function copyCredentials(result: CreateRestaurantResult) {
    const text = `Login: http://localhost:3001/login\nEmail: ${result.tenantId ? createForm.ownerEmail : ''}\nPassword: ${result.tempPassword}`
    navigator.clipboard.writeText(text)
    setCredCopied(true)
    setTimeout(() => setCredCopied(false), 2000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (search) params.search = search
      if (filterPlan) params.plan = filterPlan
      if (filterActive !== '') params.isActive = filterActive === 'true'
      const res = await listTenants(params)
      setTenants(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages || 1)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }, [page, search, filterPlan, filterActive])

  useEffect(() => { load() }, [load])

  // Seed phone prefix from browser timezone when dialog first opens
  useEffect(() => {
    if (createOpen) {
      const prefix = dialCode(detectCountryFromBrowser())
      setCreateForm(f => ({
        ...f,
        ownerPhone: isPrefixOnly(f.ownerPhone) ? prefix : f.ownerPhone,
        restaurantPhone: isPrefixOnly(f.restaurantPhone) ? prefix : f.restaurantPhone,
      }))
    }
  }, [createOpen])

  // Sync phone prefix when user changes the country dropdown (only if no number typed yet)
  useEffect(() => {
    const prefix = dialCode(createForm.country)
    setCreateForm(f => ({
      ...f,
      ownerPhone: isPrefixOnly(f.ownerPhone) ? prefix : f.ownerPhone,
      restaurantPhone: isPrefixOnly(f.restaurantPhone) ? prefix : f.restaurantPhone,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.country])

  // ─── Detail ───────────────────────────────────────────────────────────────

  async function openDetail(tenantId: string) {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    setDetailTab('overview')
    setNotes([])
    try {
      const d = await getTenantDetail(tenantId)
      setDetail(d)
      loadNotes(tenantId)
    } catch (err) {
      toast.error(apiError(err))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function loadNotes(tenantId: string) {
    setNotesLoading(true)
    try {
      setNotes(await listNotes(tenantId))
    } catch { /* non-critical */ } finally {
      setNotesLoading(false)
    }
  }

  async function handleAddNote() {
    if (!detail || !noteContent.trim()) return
    setAddingNote(true)
    try {
      const n = await createNote(detail.id, noteContent.trim())
      setNotes((prev) => [n, ...prev])
      setNoteContent('')
      toast.success('Note added')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setAddingNote(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!detail) return
    try {
      await deleteNote(detail.id, noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      toast.success('Note deleted')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  // ─── Toggle Status ─────────────────────────────────────────────────────────

  async function handleToggleStatus(t: TenantRow) {
    setBusy((b) => ({ ...b, [t.id]: true }))
    try {
      if (t.isActive) {
        await suspendTenant(t.id)
        toast.success(`${t.name} suspended`)
      } else {
        await activateTenant(t.id)
        toast.success(`${t.name} activated`)
      }
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy((b) => ({ ...b, [t.id]: false }))
    }
  }

  async function handleChangePlan(tenantId: string, plan: PlanTier) {
    setBusy((b) => ({ ...b, [tenantId]: true }))
    try {
      await updateTenantPlan(tenantId, plan)
      toast.success('Plan updated')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy((b) => ({ ...b, [tenantId]: false }))
    }
  }

  // ─── Flag / Unflag ─────────────────────────────────────────────────────────

  async function handleFlag(t: TenantRow) {
    setBusy((b) => ({ ...b, [t.id]: true }))
    try {
      if (t.flaggedForReview) {
        await unflagTenant(t.id)
        toast.success(`${t.name} unflagged`)
      } else {
        await flagTenant(t.id, 'Flagged for review')
        toast.success(`${t.name} flagged`)
      }
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy((b) => ({ ...b, [t.id]: false }))
    }
  }

  // ─── Credit ───────────────────────────────────────────────────────────────

  async function handleCredit() {
    if (!creditTenant) return
    const amount = parseFloat(creditAmount)
    if (isNaN(amount)) { toast.error('Enter a valid amount'); return }
    setCreditLoading(true)
    try {
      await applyCredit(creditTenant.id, amount, creditReason || undefined)
      toast.success(`Credit of ${amount} applied to ${creditTenant.name}`)
      setCreditOpen(false)
      setCreditAmount('')
      setCreditReason('')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setCreditLoading(false)
    }
  }

  // ─── Extend Trial ─────────────────────────────────────────────────────────

  async function handleExtendTrial() {
    if (!trialTenant) return
    const days = parseInt(trialDays)
    if (isNaN(days) || days < 1) { toast.error('Enter valid days'); return }
    setTrialLoading(true)
    try {
      await extendTrial(trialTenant.id, days)
      toast.success(`Trial extended by ${days} days for ${trialTenant.name}`)
      setTrialOpen(false)
      setTrialDays('14')
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setTrialLoading(false)
    }
  }

  // ─── Terminate ────────────────────────────────────────────────────────────

  async function handleTerminate() {
    if (!terminateTenantRow) return
    setTerminateLoading(true)
    try {
      await terminateTenant(terminateTenantRow.id)
      toast.success(`${terminateTenantRow.name} terminated`)
      setTerminateOpen(false)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setTerminateLoading(false)
    }
  }

  // ─── Assign Manager ───────────────────────────────────────────────────────

  async function openManagerDialog(t: TenantRow) {
    setManagerTenant(t)
    setSelectedManagerId(t.accountManagerId ?? '')
    setManagerOpen(true)
    try {
      setAdmins(await listSuperAdmins())
    } catch { /* best-effort */ }
  }

  async function handleAssignManager() {
    if (!managerTenant) return
    setManagerLoading(true)
    try {
      await assignManager(managerTenant.id, selectedManagerId || null)
      toast.success('Account manager updated')
      setManagerOpen(false)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setManagerLoading(false)
    }
  }

  // ─── Impersonate ──────────────────────────────────────────────────────────

  async function handleImpersonate() {
    if (!impersonateRestaurantId.trim()) { toast.error('Enter a restaurant ID'); return }
    setImpersonateLoading(true)
    try {
      const result = await impersonateTenant(impersonateTenantId, impersonateRestaurantId.trim())
      setImpersonateResult(result)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setImpersonateLoading(false)
    }
  }

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Token copied!')
  }

  function openImpersonateDialog(t: TenantRow) {
    setImpersonateTenantId(t.id)
    setImpersonateRestaurantId(t.restaurants[0]?.id ?? '')
    setImpersonateResult(null)
    setCopied(false)
    setImpersonateOpen(true)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500 mt-1">{total} total tenants on the platform</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
          <Plus size={15} /> Create Restaurant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 w-60"
          />
        </div>
        <select
          value={filterPlan}
          onChange={(e) => { setFilterPlan(e.target.value as PlanTier | ''); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Plans</option>
          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={filterActive}
          onChange={(e) => { setFilterActive(e.target.value as '' | 'true' | 'false'); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Credit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">R / U</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="h-5 animate-pulse bg-gray-100 rounded w-full" />
                        </td>
                      </tr>
                    ))
                  : tenants.map((t) => (
                      <tr key={t.id} className={`hover:bg-gray-50 ${t.terminatedAt ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{t.name}</p>
                              <p className="text-xs text-gray-400">{t.slug}</p>
                            </div>
                            {t.flaggedForReview && (
                              <span title={t.flagReason ?? 'Flagged'}>
                                <Flag size={13} className="text-amber-500" />
                              </span>
                            )}
                            {t.terminatedAt && (
                              <Badge variant="destructive" className="text-xs">Terminated</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={planVariant(t.plan)}>{t.plan}</Badge>
                            <select
                              value={t.plan}
                              disabled={busy[t.id] || !!t.terminatedAt}
                              onChange={(e) => handleChangePlan(t.id, e.target.value as PlanTier)}
                              className="text-xs border rounded px-1 py-0.5 bg-white"
                            >
                              {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={t.isActive ? 'success' : 'destructive'}>
                            {t.isActive ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {t.creditBalance > 0
                            ? <span className="text-green-600 font-medium">৳{t.creditBalance.toFixed(0)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {t.restaurantCount} / {t.userCount}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openDetail(t.id)} title="View detail">
                              <Eye size={13} />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openImpersonateDialog(t)} title="Impersonate">
                              Imp.
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={busy[t.id] || !!t.terminatedAt}
                              onClick={() => { setCreditTenant(t); setCreditOpen(true) }}
                              title="Apply credit"
                            >
                              <Coins size={13} />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={busy[t.id] || !!t.terminatedAt}
                              onClick={() => { setTrialTenant(t); setTrialOpen(true) }}
                              title="Extend trial"
                            >
                              <CalendarClock size={13} />
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={busy[t.id] || !!t.terminatedAt}
                              onClick={() => handleFlag(t)}
                              title={t.flaggedForReview ? 'Unflag' : 'Flag for review'}
                            >
                              {t.flaggedForReview ? <FlagOff size={13} className="text-amber-500" /> : <Flag size={13} />}
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              disabled={busy[t.id] || !!t.terminatedAt}
                              onClick={() => openManagerDialog(t)}
                              title="Assign manager"
                            >
                              <UserCog size={13} />
                            </Button>
                            <Button
                              variant={t.isActive ? 'destructive' : 'secondary'}
                              size="sm"
                              loading={busy[t.id]}
                              disabled={!!t.terminatedAt}
                              onClick={() => handleToggleStatus(t)}
                            >
                              {t.isActive ? 'Suspend' : 'Activate'}
                            </Button>
                            {!t.terminatedAt && (
                              <Button
                                variant="destructive" size="sm"
                                onClick={() => { setTerminateTenantRow(t); setTerminateOpen(true) }}
                                title="Terminate account"
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {pages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* ── Tenant Detail Dialog ──────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail?.name ?? 'Tenant Detail'}
              {detail?.flaggedForReview && <Flag size={15} className="text-amber-500" />}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b mb-4">
            {(['overview', 'notes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                  detailTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'notes' ? <span className="flex items-center gap-1"><StickyNote size={13} /> Notes {notes.length > 0 && `(${notes.length})`}</span> : 'Overview'}
              </button>
            ))}
          </div>

          {detailLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse bg-gray-100 rounded" />
              ))}
            </div>
          ) : detail ? (
            <>
              {detailTab === 'overview' && (
                <div className="space-y-6">

                  {/* ── Alert banners ── */}
                  {detail.terminatedAt && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                      <span className="text-base leading-none mt-0.5">✕</span>
                      <div>
                        <p className="font-semibold">Account Terminated</p>
                        <p className="text-xs text-red-500 mt-0.5">Terminated on {new Date(detail.terminatedAt).toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
                      </div>
                    </div>
                  )}
                  {detail.flaggedForReview && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                      <span className="text-base leading-none mt-0.5">⚑</span>
                      <div>
                        <p className="font-semibold">Flagged for Review</p>
                        <p className="text-xs text-amber-600 mt-0.5">{detail.flagReason ?? 'No reason provided'}</p>
                      </div>
                    </div>
                  )}

                  {/* ── KPI cards ── */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Orders',    value: detail.stats.totalOrders.toLocaleString() },
                      { label: 'Total Revenue',   value: `$${detail.stats.totalRevenue.toFixed(2)}` },
                      { label: 'Credit Balance',  value: `$${detail.creditBalance.toFixed(2)}`,
                        highlight: detail.creditBalance > 0 },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className={`text-lg font-bold ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Account details ── */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      { label: 'Slug',         value: detail.slug },
                      { label: 'Plan',         node: <Badge variant={planVariant(detail.plan)}>{detail.plan}</Badge> },
                      { label: 'Status',       node: <Badge variant={detail.isActive ? 'success' : 'destructive'}>{detail.isActive ? 'Active' : 'Suspended'}</Badge> },
                      { label: 'Member since', value: new Date(detail.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) },
                      ...(detail.trialEndsAt ? [{
                        label: 'Trial ends',
                        value: new Date(detail.trialEndsAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }),
                      }] : []),
                    ].map(({ label, value, node }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
                        {node ?? <span className="text-gray-800 font-medium">{value}</span>}
                      </div>
                    ))}
                  </div>

                  {/* ── Restaurants ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Restaurants ({detail.restaurants.length})
                    </p>
                    <div className="space-y-2">
                      {detail.restaurants.map((r) => (
                        <RestaurantBrandRow
                          key={r.id}
                          restaurant={r}
                          tenantId={selectedTenant!}
                          onUpdated={() => openDetail(selectedTenant!)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ── Users ── */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Users ({detail.users.length})
                    </p>
                    <div className="space-y-2">
                      {detail.users.map((u) => {
                        const initials = `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase()
                        const ROLE_COLORS: Record<string, string> = {
                          OWNER: 'bg-brand/10 text-brand',
                          MANAGER: 'bg-blue-50 text-blue-700',
                          CASHIER: 'bg-emerald-50 text-emerald-700',
                          WAITER: 'bg-purple-50 text-purple-700',
                        }
                        return (
                          <div key={u.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-brand/15 text-brand font-semibold text-sm flex items-center justify-center flex-shrink-0">
                              {initials}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                            {/* Role + last login */}
                            <div className="text-right flex-shrink-0 space-y-1">
                              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                {u.role}
                              </span>
                              <p className="text-xs text-gray-400">
                                {u.lastLoginAt
                                  ? `Login ${new Date(u.lastLoginAt).toLocaleDateString('en-GB', { dateStyle: 'short' })}`
                                  : 'Never logged in'}
                              </p>
                            </div>
                            {/* Reset password */}
                            <button
                              onClick={() => handleSendPasswordReset(detail.id, u.id, u.email ?? '')}
                              disabled={resetLoadingId === u.id || !u.email}
                              title={u.email ? 'Send password reset email' : 'No email address'}
                              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-brand hover:text-brand disabled:opacity-40 transition-colors"
                            >
                              {resetLoadingId === u.id ? '…' : 'Reset pwd'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )}

              {detailTab === 'notes' && (
                <div className="space-y-4">
                  {/* Add note */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add an internal note…"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <Button
                      size="sm"
                      loading={addingNote}
                      disabled={!noteContent.trim()}
                      onClick={handleAddNote}
                    >
                      <Plus size={13} className="mr-1" /> Add Note
                    </Button>
                  </div>

                  {/* Notes list */}
                  {notesLoading ? (
                    <div className="h-10 animate-pulse bg-gray-100 rounded" />
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map((n) => (
                        <div key={n.id} className="border rounded px-3 py-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-gray-800 flex-1">{n.content}</p>
                            <button
                              onClick={() => handleDeleteNote(n.id)}
                              className="text-gray-400 hover:text-red-500 mt-0.5"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {n.authorEmail} · {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Apply Credit Dialog ───────────────────────────────────────────── */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Credit — {creditTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Amount (positive = credit, negative = debit)</label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Reason (optional)</label>
              <Input
                placeholder="e.g. Goodwill credit for downtime"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreditOpen(false)}>Cancel</Button>
            <Button loading={creditLoading} onClick={handleCredit}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Extend Trial Dialog ───────────────────────────────────────────── */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend Trial — {trialTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Days to extend</label>
            <Input
              type="number"
              min={1}
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
            />
            {trialTenant?.trialEndsAt && (
              <p className="text-xs text-gray-500">
                Current trial ends: {new Date(trialTenant.trialEndsAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTrialOpen(false)}>Cancel</Button>
            <Button loading={trialLoading} onClick={handleExtendTrial}>Extend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Terminate Confirm Dialog ──────────────────────────────────────── */}
      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Terminate Account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This will <strong>permanently terminate</strong> <strong>{terminateTenantRow?.name}</strong> and deactivate all their users. This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={terminateLoading} onClick={handleTerminate}>
              Yes, Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Manager Dialog ─────────────────────────────────────────── */}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Account Manager — {managerTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Account Manager</label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— Unassigned —</option>
              {admins.filter((a) => a.isActive).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.firstName} {a.lastName} ({a.email})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setManagerOpen(false)}>Cancel</Button>
            <Button loading={managerLoading} onClick={handleAssignManager}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Impersonate Dialog ────────────────────────────────────────────── */}
      <Dialog open={impersonateOpen} onOpenChange={(o) => { setImpersonateOpen(o); if (!o) setImpersonateResult(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Impersonate Tenant</DialogTitle>
          </DialogHeader>
          {impersonateResult ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Impersonating as <strong>{impersonateResult.impersonating.userEmail}</strong> in{' '}
                <strong>{impersonateResult.impersonating.restaurantName}</strong>. Token expires in 1 hour.
              </p>
              <div className="bg-gray-50 rounded border p-3">
                <p className="text-xs text-gray-400 mb-1 font-medium">ACCESS TOKEN</p>
                <p className="text-xs font-mono break-all text-gray-700">{impersonateResult.accessToken}</p>
              </div>
              <Button className="w-full" onClick={() => copyToken(impersonateResult!.accessToken)} variant={copied ? 'secondary' : 'default'}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Token</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Issue a 1-hour impersonation token scoped to a restaurant.</p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Restaurant ID</label>
                <Input
                  placeholder="UUID of the restaurant"
                  value={impersonateRestaurantId}
                  onChange={(e) => setImpersonateRestaurantId(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImpersonateOpen(false)}>Cancel</Button>
                <Button loading={impersonateLoading} onClick={handleImpersonate}>Generate Token</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Restaurant Dialog ───────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) closeCreateDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{createResult ? 'Restaurant Created' : 'Create Restaurant Account'}</DialogTitle>
          </DialogHeader>

          {createResult ? (
            /* ── Success state: show credentials ── */
            <div className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800 mb-1">Account created successfully.</p>
                <p className="text-xs text-green-700">
                  {createResult.welcomeEmailSent
                    ? 'A welcome email with these credentials has been sent to the owner.'
                    : 'No welcome email was sent. Share these credentials manually.'}
                </p>
              </div>

              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Temporary Credentials — Copy Now</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-mono text-gray-800">{createForm.ownerEmail}</span>
                  <span className="text-gray-500">Temporary Password</span>
                  <span className="font-mono font-bold text-lg tracking-widest text-indigo-700">{createResult.tempPassword}</span>
                  <span className="text-gray-500">Plan</span>
                  <span className="text-gray-800">{createResult.plan}</span>
                  <span className="text-gray-500">Trial Ends</span>
                  <span className="text-gray-800">{createResult.trialEndsAt ? new Date(createResult.trialEndsAt).toLocaleDateString() : 'No trial'}</span>
                </div>
                <div className="pt-1 text-xs text-amber-700 font-medium">
                  The password will not be shown again after you close this dialog.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <div><span className="font-medium">Tenant ID</span><p className="font-mono mt-0.5">{createResult.tenantId}</p></div>
                <div><span className="font-medium">Restaurant ID</span><p className="font-mono mt-0.5">{createResult.restaurantId}</p></div>
                <div><span className="font-medium">User ID</span><p className="font-mono mt-0.5">{createResult.userId}</p></div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => copyCredentials(createResult)} className="flex items-center gap-2">
                  {credCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Credentials</>}
                </Button>
                <Button onClick={closeCreateDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            /* ── Form state ── */
            <div className="space-y-6">
              {/* Owner Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b">Owner Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">First Name *</label>
                    <Input value={createForm.ownerFirstName} onChange={(e) => setField('ownerFirstName', e.target.value)} placeholder="Ahmed" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Last Name *</label>
                    <Input value={createForm.ownerLastName} onChange={(e) => setField('ownerLastName', e.target.value)} placeholder="Rahman" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email Address * (used to log in)</label>
                    <Input type="email" value={createForm.ownerEmail} onChange={(e) => setField('ownerEmail', e.target.value)} placeholder="owner@restaurant.com" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Phone (optional)</label>
                    <PhoneInput value={createForm.ownerPhone} onChange={v => setField('ownerPhone', v)} placeholder="+8801700000000" />
                  </div>
                </div>
              </div>

              {/* Restaurant Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b">Restaurant Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Restaurant Name *</label>
                    <Input value={createForm.restaurantName} onChange={(e) => setField('restaurantName', e.target.value)} placeholder="Spice Garden" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Country * (ISO code)</label>
                    <select
                      value={createForm.country}
                      onChange={(e) => setField('country', e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="BD">BD — Bangladesh (BDT)</option>
                      <option value="IN">IN — India (INR)</option>
                      <option value="US">US — United States (USD)</option>
                      <option value="GB">GB — United Kingdom (GBP)</option>
                      <option value="AE">AE — UAE (AED)</option>
                      <option value="SA">SA — Saudi Arabia (SAR)</option>
                      <option value="MY">MY — Malaysia (MYR)</option>
                      <option value="SG">SG — Singapore (SGD)</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Auto-sets currency and timezone.</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">City (optional)</label>
                    <Input value={createForm.city} onChange={(e) => setField('city', e.target.value)} placeholder="Dhaka" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">Address (optional)</label>
                    <Input value={createForm.address} onChange={(e) => setField('address', e.target.value)} placeholder="123 Main Street, Gulshan" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Restaurant Phone (optional)</label>
                    <PhoneInput value={createForm.restaurantPhone} onChange={v => setField('restaurantPhone', v)} placeholder="+8801900000000" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Restaurant Email (optional)</label>
                    <Input type="email" value={createForm.restaurantEmail} onChange={(e) => setField('restaurantEmail', e.target.value)} placeholder="info@restaurant.com" />
                  </div>
                </div>
              </div>

              {/* Plan Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b">Plan & Trial</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Plan *</label>
                    <select
                      value={createForm.plan}
                      onChange={(e) => setField('plan', e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="STARTER">Starter — $49/mo</option>
                      <option value="GROWTH">Growth — $129/mo</option>
                      <option value="PRO">Pro — $299/mo</option>
                      <option value="ENTERPRISE">Enterprise — Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Trial Days (0 = no trial)</label>
                    <Input
                      type="number" min="0" max="90"
                      value={createForm.trialDays}
                      onChange={(e) => setField('trialDays', e.target.value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">Standard is 14 days.</p>
                  </div>
                </div>
              </div>

              {/* SA-only Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b">Internal (SA Only)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Internal Notes (optional)</label>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Met at restaurant expo — owner expressed interest in Growth plan. Referral from Rahim."
                      value={createForm.internalNotes}
                      onChange={(e) => setField('internalNotes', e.target.value)}
                      className="resize-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.sendWelcomeEmail}
                      onChange={(e) => setField('sendWelcomeEmail', e.target.checked)}
                      className="rounded"
                    />
                    Send welcome email with login credentials to owner
                  </label>
                  <p className="text-xs text-amber-600">
                    A temporary password will be auto-generated and shown once after creation.
                    {createForm.sendWelcomeEmail ? ' It will also be emailed to the owner.' : ' It will NOT be emailed — copy it manually.'}
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
                <Button
                  loading={createLoading}
                  disabled={
                    !createForm.ownerFirstName || !createForm.ownerLastName || !createForm.ownerEmail || !createForm.restaurantName ||
                    !isValidPhone(createForm.ownerPhone) || !isValidPhone(createForm.restaurantPhone)
                  }
                  onClick={handleCreateRestaurant}
                >
                  Create Restaurant
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
