import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  Clock,
  Gift,
  MapPin,
  Star,
  ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

import { useAuthStore } from '@/store/auth.store'
import { crmApi } from '@/lib/crm.api'
import { customersApi } from '@/lib/customers.api'
import { apiError } from '@/lib/api'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { CustomerWithSegment } from '@/types/crm.types'

// ─── Local Types ──────────────────────────────────────────────────────────────

interface CustomerDetail {
  id: string
  firstName: string
  lastName?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  dateOfBirth?: string | null
  isBlacklisted: boolean
  createdAt: string
}

interface CustomerOrder {
  id: string
  orderNumber: string
  status: string
  orderType?: string | null
  channel?: string | null
  totalAmount: number
  cartToken?: string | null
  createdAt: string
  items?: Array<{ name?: string | null; quantity: number }>
}

interface LoyaltyTransaction {
  id: string
  type: string
  points: number
  description?: string | null
  createdAt: string
}

interface LoyaltyAccount {
  id: string
  currentPoints: number
  totalEarned: number
  totalRedeemed: number
  tier: string
  transactions: LoyaltyTransaction[]
}

interface Address {
  id: string
  label?: string | null
  line1: string
  line2?: string | null
  city: string
  area?: string | null
  postalCode?: string | null
  isDefault: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REGULAR: 'bg-green-100 text-green-800',
  VIP: 'bg-purple-100 text-purple-800',
  DORMANT: 'bg-gray-100 text-gray-600',
  AT_RISK: 'bg-red-100 text-red-700',
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-gray-100 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-800',
  PLATINUM: 'bg-violet-100 text-violet-800',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-emerald-100 text-emerald-800',
  SERVED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
  VOIDED: 'bg-gray-100 text-gray-600',
}

const CHANNEL_COLORS: Record<string, string> = {
  DINE_IN: 'bg-green-100 text-green-800',
  TAKEAWAY: 'bg-blue-100 text-blue-800',
  DELIVERY: 'bg-orange-100 text-orange-800',
  QR: 'bg-purple-100 text-purple-800',
  ONLINE: 'bg-orange-100 text-orange-800',
  POS: 'bg-blue-100 text-blue-800',
}

const TIER_THRESHOLDS = [
  { name: 'BRONZE', min: 0, max: 499 },
  { name: 'SILVER', min: 500, max: 999 },
  { name: 'GOLD', min: 1000, max: 1999 },
  { name: 'PLATINUM', min: 2000, max: Infinity },
]

const SEGMENTS = [
  { value: '', label: 'All' },
  { value: 'NEW', label: 'New' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'VIP', label: 'VIP' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'DORMANT', label: 'Dormant' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(date: string | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
}

function relativeDate(date: string | null | undefined): string {
  const d = daysSince(date)
  if (d === null) return 'Never'
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}yr ago`
}

function getOrderChannel(order: CustomerOrder): string {
  if (order.cartToken) return 'ONLINE'
  if (order.channel === 'QR' || order.orderType === 'QR') return 'QR'
  return order.orderType ?? order.channel ?? 'POS'
}

function deriveFavorites(orders: CustomerOrder[]): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const name = item.name ?? 'Unknown'
      counts[name] = (counts[name] ?? 0) + item.quantity
    }
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

function deriveTimePref(orders: CustomerOrder[]): string {
  const buckets: Record<string, number> = { morning: 0, lunch: 0, evening: 0, night: 0 }
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours()
    if (h >= 6 && h < 11) buckets.morning++
    else if (h >= 11 && h < 15) buckets.lunch++
    else if (h >= 15 && h < 20) buckets.evening++
    else buckets.night++
  }
  const labels: Record<string, string> = { morning: 'Morning', lunch: 'Lunch', evening: 'Evening', night: 'Night' }
  const top2 = Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, v]) => v > 0)
    .map(([k]) => labels[k])
  return top2.length ? top2.join(' & ') : 'N/A'
}

// ─── Small Components ─────────────────────────────────────────────────────────

function SegmentBadge({ segment }: { segment: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEGMENT_COLORS[segment] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {segment.replace('_', ' ')}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'}`}
    >
      <Star size={9} />
      {tier}
    </span>
  )
}

// ─── Create Customer Dialog ───────────────────────────────────────────────────

interface CreateCustomerDialogProps {
  restaurantId: string
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

function CreateCustomerDialog({ restaurantId, open, onClose, onCreated }: CreateCustomerDialogProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    notes: '',
    dateOfBirth: '',
  })

  function reset() {
    setForm({ firstName: '', lastName: '', phone: '', email: '', notes: '', dateOfBirth: '' })
  }

  const mut = useMutation({
    mutationFn: () =>
      customersApi.create(restaurantId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
      }),
    onSuccess: (customer: any) => {
      qc.invalidateQueries({ queryKey: ['crm-customers'] })
      toast.success('Customer created')
      reset()
      onCreated(customer.id)
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label>First Name *</Label>
            <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+880..." />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
          </div>
          <div className="col-span-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Preferences, dietary restrictions…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!form.firstName.trim() || mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Customer Dialog ─────────────────────────────────────────────────────

function EditCustomerDialog({
  restaurantId,
  customer,
  open,
  onClose,
}: {
  restaurantId: string
  customer: CustomerDetail
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    notes: customer.notes ?? '',
    dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
  })

  useEffect(() => {
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName ?? '',
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
    })
  }, [customer.id])

  const mut = useMutation({
    mutationFn: () =>
      customersApi.update(restaurantId, customer.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        notes: form.notes.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-customers'] })
      qc.invalidateQueries({ queryKey: ['customer-detail', restaurantId, customer.id] })
      toast.success('Customer updated')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label>First Name *</Label>
            <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!form.firstName.trim() || mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Earn Points Dialog ───────────────────────────────────────────────────────

function EarnPointsDialog({
  restaurantId,
  customerId,
  open,
  onClose,
}: {
  restaurantId: string
  customerId: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'amount' | 'direct'>('amount')
  const [amount, setAmount] = useState('')
  const [points, setPoints] = useState('')
  const [description, setDescription] = useState('')

  const previewPoints = mode === 'amount' ? Math.floor(Number(amount) / 10) : Number(points)

  const mut = useMutation({
    mutationFn: () =>
      customersApi.earnPoints(restaurantId, customerId, {
        amount: mode === 'amount' ? Number(amount) : undefined,
        points: mode === 'direct' ? Number(points) : undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-loyalty', restaurantId, customerId] })
      qc.invalidateQueries({ queryKey: ['crm-customers'] })
      toast.success(`${previewPoints} points added`)
      setAmount('')
      setPoints('')
      setDescription('')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const valid = mode === 'amount' ? Number(amount) > 0 : Number(points) > 0

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Earn Points</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              className={cn('flex-1 py-2 font-medium transition-colors', mode === 'amount' ? 'bg-brand text-white' : 'hover:bg-gray-50')}
              onClick={() => setMode('amount')}
            >
              By Amount
            </button>
            <button
              className={cn('flex-1 py-2 font-medium transition-colors', mode === 'direct' ? 'bg-brand text-white' : 'hover:bg-gray-50')}
              onClick={() => setMode('direct')}
            >
              Direct Points
            </button>
          </div>
          {mode === 'amount' ? (
            <div>
              <Label>Order Amount (৳)</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 2000"
              />
              {Number(amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">= {Math.floor(Number(amount) / 10)} points</p>
              )}
            </div>
          ) : (
            <div>
              <Label>Points to Add</Label>
              <Input
                type="number"
                min={1}
                value={points}
                onChange={e => setPoints(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
          )}
          <div>
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Manual adjustment, bonus…"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending ? 'Adding…' : 'Earn Points'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Redeem Points Dialog ─────────────────────────────────────────────────────

function RedeemPointsDialog({
  restaurantId,
  customerId,
  currentPoints,
  open,
  onClose,
}: {
  restaurantId: string
  customerId: string
  currentPoints: number
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [points, setPoints] = useState('')
  const [description, setDescription] = useState('')

  const num = Number(points)
  const valid = num > 0 && num <= currentPoints

  const mut = useMutation({
    mutationFn: () =>
      customersApi.redeemPoints(restaurantId, customerId, {
        points: num,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-loyalty', restaurantId, customerId] })
      qc.invalidateQueries({ queryKey: ['crm-customers'] })
      toast.success(`${points} points redeemed`)
      setPoints('')
      setDescription('')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Redeem Points</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Available: <span className="font-semibold text-gray-900">{currentPoints} pts</span>
          </p>
          <div>
            <Label>Points to Redeem</Label>
            <Input
              type="number"
              min={1}
              max={currentPoints}
              value={points}
              onChange={e => setPoints(e.target.value)}
              placeholder={`Max ${currentPoints}`}
            />
            {num > currentPoints && (
              <p className="text-xs text-red-500 mt-1">Exceeds available balance</p>
            )}
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Redemption reason…"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending ? 'Redeeming…' : 'Redeem Points'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Address Dialog ───────────────────────────────────────────────────────────

function AddressDialog({
  restaurantId,
  customerId,
  address,
  open,
  onClose,
}: {
  restaurantId: string
  customerId: string
  address?: Address
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    label: address?.label ?? 'Home',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    city: address?.city ?? '',
    area: address?.area ?? '',
    postalCode: address?.postalCode ?? '',
    isDefault: address?.isDefault ?? false,
  })

  useEffect(() => {
    setForm({
      label: address?.label ?? 'Home',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      city: address?.city ?? '',
      area: address?.area ?? '',
      postalCode: address?.postalCode ?? '',
      isDefault: address?.isDefault ?? false,
    })
  }, [address?.id, open])

  const mut = useMutation({
    mutationFn: () =>
      address
        ? customersApi.updateAddress(restaurantId, customerId, address.id, {
            label: form.label.trim() || undefined,
            line1: form.line1.trim(),
            line2: form.line2.trim() || undefined,
            city: form.city.trim(),
            area: form.area.trim() || undefined,
            postalCode: form.postalCode.trim() || undefined,
            isDefault: form.isDefault,
          })
        : customersApi.addAddress(restaurantId, customerId, {
            label: form.label.trim() || undefined,
            line1: form.line1.trim(),
            line2: form.line2.trim() || undefined,
            city: form.city.trim(),
            area: form.area.trim() || undefined,
            postalCode: form.postalCode.trim() || undefined,
            isDefault: form.isDefault,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-addresses', restaurantId, customerId] })
      toast.success(address ? 'Address updated' : 'Address added')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const valid = !!form.line1.trim() && !!form.city.trim()

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{address ? 'Edit Address' : 'Add Address'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Label</Label>
            <select
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="Home">Home</option>
              <option value="Work">Work</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <Label>Address Line 1 *</Label>
            <Input
              value={form.line1}
              onChange={e => setForm(f => ({ ...f, line1: e.target.value }))}
              placeholder="Street, building number…"
            />
          </div>
          <div>
            <Label>Address Line 2</Label>
            <Input
              value={form.line2}
              onChange={e => setForm(f => ({ ...f, line2: e.target.value }))}
              placeholder="Apt, floor, suite…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City *</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Dhaka" />
            </div>
            <div>
              <Label>Area</Label>
              <Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Gulshan" />
            </div>
          </div>
          <div>
            <Label>Postal Code</Label>
            <Input
              value={form.postalCode}
              onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
              placeholder="1212"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="rounded"
            />
            Set as default address
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!valid || mut.isPending}>
            {mut.isPending ? 'Saving…' : address ? 'Update Address' : 'Add Address'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  customer,
  restaurantId,
  orders,
}: {
  customer: CustomerDetail
  restaurantId: string
  orders: CustomerOrder[]
}) {
  const qc = useQueryClient()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(customer.notes ?? '')

  const { data: stampProgress } = useQuery({
    queryKey: ['stamp-progress', restaurantId, customer.id],
    queryFn: () => crmApi.getStampProgress(restaurantId, customer.id),
    enabled: !!restaurantId && !!customer.id,
  })

  const saveNotesMut = useMutation({
    mutationFn: () =>
      customersApi.update(restaurantId, customer.id, { notes: notes.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-detail', restaurantId, customer.id] })
      toast.success('Notes saved')
      setEditingNotes(false)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const favorites = useMemo(() => deriveFavorites(orders), [orders])
  const timePref = useMemo(() => deriveTimePref(orders), [orders])

  return (
    <div className="space-y-4 p-4">
      {/* Notes */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Notes & Preferences</h3>
          {!editingNotes && (
            <button
              onClick={() => { setNotes(customer.notes ?? ''); setEditingNotes(true) }}
              className="text-xs text-brand hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Preferences, dietary restrictions…"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveNotesMut.mutate()} disabled={saveNotesMut.isPending}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            {customer.notes || <span className="italic text-gray-400">No notes</span>}
          </p>
        )}
      </div>

      {/* DOB + Time preference */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Calendar size={12} /> Date of Birth
          </p>
          <p className="text-sm font-medium">
            {customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '—'}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Clock size={12} /> Prefers
          </p>
          <p className="text-sm font-medium">{timePref}</p>
        </div>
      </div>

      {/* Favorite items */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Star size={14} /> Favorite Items
        </h3>
        {favorites.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No order history yet</p>
        ) : (
          <div className="space-y-2">
            {favorites.map((f, i) => (
              <div key={f.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm text-gray-800">{f.name}</span>
                </div>
                <span className="text-xs font-medium text-brand">×{f.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stamp card progress */}
      {stampProgress && (stampProgress as any[]).length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Gift size={14} /> Stamp Cards
          </h3>
          <div className="space-y-3">
            {(stampProgress as any[]).map((sp) => (
              <div key={sp.stampCard.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{sp.stampCard.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {sp.stamps} / {sp.stampCard.stampsRequired}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (sp.stamps / sp.stampCard.stampsRequired) * 100)}%`,
                    }}
                  />
                </div>
                {sp.isComplete && !sp.redeemedAt && (
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    Ready to redeem: {sp.stampCard.rewardDesc}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({
  restaurantId,
  customerId,
}: {
  restaurantId: string
  customerId: string
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const limit = 10

  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders-paged', restaurantId, customerId, page],
    queryFn: () => customersApi.getOrders(restaurantId, customerId, { page, limit }),
    enabled: !!restaurantId && !!customerId,
  })

  const orders: CustomerOrder[] = useMemo(() => {
    const d = data as any
    return d?.orders ?? d ?? []
  }, [data])

  const total: number = (data as any)?.total ?? orders.length
  const totalPages = Math.ceil(total / limit)

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-400">Loading orders…</div>
  }

  return (
    <div className="p-4 space-y-3">
      {orders.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">No orders yet</p>
      )}
      {orders.map((order) => {
        const channel = getOrderChannel(order)
        return (
          <div
            key={order.id}
            className="rounded-lg border bg-white p-3 flex items-center justify-between hover:border-brand/40 transition-colors cursor-pointer"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[channel] ?? 'bg-gray-100 text-gray-600'}`}>
                {channel}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {order.status}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-sm font-semibold">{formatCurrency(order.totalAmount)}</span>
              <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
              <ChevronRight size={14} className="text-gray-400" />
            </div>
          </div>
        )
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Loyalty Tab ──────────────────────────────────────────────────────────────

function LoyaltyTab({
  restaurantId,
  customerId,
}: {
  restaurantId: string
  customerId: string
}) {
  const [earnOpen, setEarnOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)

  const { data: loyaltyData, isLoading } = useQuery({
    queryKey: ['customer-loyalty', restaurantId, customerId],
    queryFn: () => customersApi.getLoyalty(restaurantId, customerId),
    enabled: !!restaurantId && !!customerId,
  })

  const account = loyaltyData as LoyaltyAccount | undefined

  const currentTier = TIER_THRESHOLDS.find(
    t => (account?.totalEarned ?? 0) >= t.min && (account?.totalEarned ?? 0) <= t.max,
  )
  const nextTier = currentTier ? TIER_THRESHOLDS[TIER_THRESHOLDS.indexOf(currentTier) + 1] : undefined
  const tierProgress =
    currentTier && nextTier
      ? Math.min(
          100,
          (((account?.totalEarned ?? 0) - currentTier.min) / (nextTier.min - currentTier.min)) * 100,
        )
      : 100

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading loyalty…</div>
  if (!account) return <div className="p-6 text-sm text-gray-400 italic">No loyalty account found</div>

  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3 text-center">
          <p className="text-xl font-bold text-brand">{account.currentPoints}</p>
          <p className="text-xs text-muted-foreground">Current Points</p>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{account.totalEarned}</p>
          <p className="text-xs text-muted-foreground">Total Earned</p>
        </div>
        <div className="rounded-lg border bg-white p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{account.totalRedeemed}</p>
          <p className="text-xs text-muted-foreground">Total Redeemed</p>
        </div>
      </div>

      {/* Tier progress */}
      {nextTier && (
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <TierBadge tier={account.tier ?? 'BRONZE'} />
            <span className="text-xs text-muted-foreground">
              {account.totalEarned} / {nextTier.min} pts to {nextTier.name}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${tierProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => setEarnOpen(true)}>
          <Gift size={14} className="mr-2" />
          Earn Points
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setRedeemOpen(true)}
          disabled={account.currentPoints === 0}
        >
          Redeem Points
        </Button>
      </div>

      {/* Transaction history */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-4 py-2 border-b bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Transaction History</h3>
        </div>
        {account.transactions.length === 0 ? (
          <p className="text-sm text-gray-400 italic p-4 text-center">No transactions</p>
        ) : (
          <div className="divide-y">
            {account.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      tx.type === 'EARN' && 'bg-green-100 text-green-700',
                      tx.type === 'REDEEM' && 'bg-orange-100 text-orange-700',
                      (tx.type === 'ADJUST' || tx.type === 'EXPIRE') && 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {tx.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{tx.description || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      tx.type === 'EARN' ? 'text-green-700' : tx.type === 'REDEEM' ? 'text-orange-700' : 'text-gray-700',
                    )}
                  >
                    {tx.type === 'EARN' ? '+' : tx.type === 'REDEEM' ? '-' : ''}
                    {tx.points}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <EarnPointsDialog
        restaurantId={restaurantId}
        customerId={customerId}
        open={earnOpen}
        onClose={() => setEarnOpen(false)}
      />
      <RedeemPointsDialog
        restaurantId={restaurantId}
        customerId={customerId}
        currentPoints={account.currentPoints}
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
      />
    </div>
  )
}

// ─── Addresses Tab ────────────────────────────────────────────────────────────

function AddressesTab({
  restaurantId,
  customerId,
}: {
  restaurantId: string
  customerId: string
}) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editAddress, setEditAddress] = useState<Address | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: addressesData = [], isLoading } = useQuery({
    queryKey: ['customer-addresses', restaurantId, customerId],
    queryFn: () => customersApi.listAddresses(restaurantId, customerId),
    enabled: !!restaurantId && !!customerId,
  })

  const addresses = addressesData as Address[]

  const deleteMut = useMutation({
    mutationFn: (aid: string) => customersApi.deleteAddress(restaurantId, customerId, aid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-addresses', restaurantId, customerId] })
      toast.success('Address removed')
      setDeleteId(null)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} className="mr-1" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 && (
        <p className="text-sm text-gray-400 italic text-center py-8">No addresses saved</p>
      )}

      {addresses.map((addr) => (
        <div key={addr.id} className="rounded-lg border bg-white p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-brand mt-0.5 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-800">{addr.label ?? 'Address'}</span>
                {addr.isDefault && (
                  <span className="px-1.5 py-0.5 bg-brand/10 text-brand text-xs font-medium rounded">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
              </p>
              <p className="text-sm text-gray-600">
                {[addr.area, addr.city, addr.postalCode].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setEditAddress(addr)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeleteId(addr.id)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <AddressDialog
        restaurantId={restaurantId}
        customerId={customerId}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      {editAddress && (
        <AddressDialog
          restaurantId={restaurantId}
          customerId={customerId}
          address={editAddress}
          open={!!editAddress}
          onClose={() => setEditAddress(null)}
        />
      )}

      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Address</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">Are you sure you want to remove this address?</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Customer Detail Panel ────────────────────────────────────────────────────

type DetailTab = 'overview' | 'orders' | 'loyalty' | 'addresses'

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'addresses', label: 'Addresses' },
]

function CustomerDetailPanel({
  restaurantId,
  selected,
  onDeselect,
}: {
  restaurantId: string
  selected: CustomerWithSegment
  onDeselect: () => void
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<DetailTab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [earnOpen, setEarnOpen] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)

  const { data: customerData } = useQuery({
    queryKey: ['customer-detail', restaurantId, selected.id],
    queryFn: () => customersApi.get(restaurantId, selected.id),
    enabled: !!restaurantId && !!selected.id,
  })

  const { data: ordersAllData } = useQuery({
    queryKey: ['customer-orders-all', restaurantId, selected.id],
    queryFn: () => customersApi.getOrders(restaurantId, selected.id, { limit: 200 }),
    enabled: !!restaurantId && !!selected.id,
  })

  const { data: loyaltyData } = useQuery({
    queryKey: ['customer-loyalty', restaurantId, selected.id],
    queryFn: () => customersApi.getLoyalty(restaurantId, selected.id),
    enabled: !!restaurantId && !!selected.id,
  })

  const customer = customerData as CustomerDetail | undefined
  const loyalty = loyaltyData as LoyaltyAccount | undefined

  const allOrders: CustomerOrder[] = useMemo(() => {
    const d = ordersAllData as any
    return d?.orders ?? d ?? []
  }, [ordersAllData])

  const totalVisits = selected.totalOrders
  const ltv = useMemo(() => allOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0), [allOrders])
  const avgOrder = totalVisits > 0 ? ltv / totalVisits : 0
  const lastVisitStr = relativeDate(selected.lastOrderAt)
  const daysSinceLastOrder = daysSince(selected.lastOrderAt)

  const blacklistMut = useMutation({
    mutationFn: () => customersApi.toggleBlacklist(restaurantId, selected.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-customers'] })
      qc.invalidateQueries({ queryKey: ['customer-detail', restaurantId, selected.id] })
      toast.success(selected.isBlacklisted ? 'Blacklist removed' : 'Customer blacklisted')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-muted">
      {/* Profile Header */}
      <div className="bg-white border-b px-5 py-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">
                {selected.firstName} {selected.lastName ?? ''}
              </h2>
              {selected.isBlacklisted && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <AlertCircle size={10} /> Blacklisted
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Member since {customer ? formatDate(customer.createdAt) : '…'}
            </p>
          </div>
          <button
            onClick={onDeselect}
            className="text-gray-400 hover:text-gray-600 p-1 rounded text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Contact info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
          {selected.phone && (
            <span className="flex items-center gap-1">
              <Phone size={11} />
              {selected.phone}
            </span>
          )}
          {selected.email && (
            <span className="flex items-center gap-1">
              <Mail size={11} />
              {selected.email}
            </span>
          )}
        </div>

        {/* KPI chips */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg bg-gray-50 border p-2 text-center">
            <p className="text-base font-bold text-gray-900">{totalVisits}</p>
            <p className="text-2xs text-muted-foreground">Visits</p>
          </div>
          <div className="rounded-lg bg-gray-50 border p-2 text-center">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(ltv)}</p>
            <p className="text-2xs text-muted-foreground">Lifetime</p>
          </div>
          <div className="rounded-lg bg-gray-50 border p-2 text-center">
            <p className="text-sm font-bold text-gray-900">{formatCurrency(avgOrder)}</p>
            <p className="text-2xs text-muted-foreground">Avg Order</p>
          </div>
          <div className="rounded-lg bg-gray-50 border p-2 text-center">
            <p className="text-base font-bold text-gray-900 leading-tight">{lastVisitStr}</p>
            <p className="text-2xs text-muted-foreground">Last Visit</p>
          </div>
        </div>

        {/* Segment badges + context */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SegmentBadge segment={selected.segment} />
          {selected.loyaltyTier && <TierBadge tier={selected.loyaltyTier} />}
          {selected.loyaltyPoints > 0 && (
            <span className="text-xs text-muted-foreground">{selected.loyaltyPoints} pts</span>
          )}
          {selected.segment === 'AT_RISK' && daysSinceLastOrder !== null && (
            <span className="text-xs text-red-600 font-medium">
              ⚠ {daysSinceLastOrder}d since last order
            </span>
          )}
          {selected.segment === 'DORMANT' && daysSinceLastOrder !== null && (
            <span className="text-xs text-gray-500">Inactive {daysSinceLastOrder}d</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil size={12} className="mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={selected.isBlacklisted ? '' : 'text-red-600 border-red-200 hover:bg-red-50'}
            onClick={() => blacklistMut.mutate()}
            disabled={blacklistMut.isPending}
          >
            <AlertCircle size={12} className="mr-1" />
            {selected.isBlacklisted ? 'Unblacklist' : 'Blacklist'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEarnOpen(true)}>
            <Gift size={12} className="mr-1" />
            Earn
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRedeemOpen(true)}
            disabled={(loyalty?.currentPoints ?? 0) === 0}
          >
            Redeem
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b bg-white flex-shrink-0">
        {DETAIL_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && customer && (
          <OverviewTab customer={customer} restaurantId={restaurantId} orders={allOrders} />
        )}
        {tab === 'overview' && !customer && (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        )}
        {tab === 'orders' && (
          <OrdersTab restaurantId={restaurantId} customerId={selected.id} />
        )}
        {tab === 'loyalty' && (
          <LoyaltyTab restaurantId={restaurantId} customerId={selected.id} />
        )}
        {tab === 'addresses' && (
          <AddressesTab restaurantId={restaurantId} customerId={selected.id} />
        )}
      </div>

      {/* Dialogs controlled from header */}
      {customer && editOpen && (
        <EditCustomerDialog
          restaurantId={restaurantId}
          customer={customer}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      <EarnPointsDialog
        restaurantId={restaurantId}
        customerId={selected.id}
        open={earnOpen}
        onClose={() => setEarnOpen(false)}
      />
      {loyalty && (
        <RedeemPointsDialog
          restaurantId={restaurantId}
          customerId={selected.id}
          currentPoints={loyalty.currentPoints}
          open={redeemOpen}
          onClose={() => setRedeemOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: listData, isLoading } = useQuery({
    queryKey: ['crm-customers', restaurantId, debouncedSearch, segment],
    queryFn: () =>
      crmApi.listCustomers(restaurantId, {
        search: debouncedSearch || undefined,
        segment: segment || undefined,
        limit: 100,
      }),
    enabled: !!restaurantId,
  })

  const customers: CustomerWithSegment[] = useMemo(() => {
    const d = listData as any
    return d?.customers ?? d ?? []
  }, [listData])

  const selected = useMemo(
    () => customers.find(c => c.id === selectedId) ?? null,
    [customers, selectedId],
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-brand" />
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">({customers.length})</span>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" />
          New Customer
        </Button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Customer List */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-r flex flex-col bg-white overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, email…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>

          {/* Segment filter chips */}
          <div className="px-3 py-2 border-b flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => (
              <button
                key={s.value}
                onClick={() => setSegment(s.value)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors',
                  segment === s.value
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="p-4 text-sm text-gray-400 text-center">Loading…</div>
            )}
            {!isLoading && customers.length === 0 && (
              <div className="p-6 text-sm text-gray-400 italic text-center">No customers found</div>
            )}
            {customers.map(customer => {
              const days = daysSince(customer.lastOrderAt)
              const isSelected = customer.id === selectedId
              return (
                <button
                  key={customer.id}
                  onClick={() => setSelectedId(customer.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b transition-colors hover:bg-gray-50',
                    isSelected && 'bg-brand/5 border-l-2 border-l-brand',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {customer.firstName} {customer.lastName ?? ''}
                        </span>
                        {customer.isBlacklisted && (
                          <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {customer.phone ?? customer.email ?? 'No contact info'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        {customer.loyaltyTier && <TierBadge tier={customer.loyaltyTier} />}
                        <SegmentBadge segment={customer.segment} />
                      </div>
                      <span className="text-2xs text-muted-foreground">
                        {days === null ? 'Never visited' : days === 0 ? 'Today' : `${days}d ago`}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <CustomerDetailPanel
              key={selected.id}
              restaurantId={restaurantId}
              selected={selected}
              onDeselect={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
              <div>
                <Users size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a customer to view details</p>
                <p className="text-xs mt-1 opacity-70">or create a new customer</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateCustomerDialog
        restaurantId={restaurantId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  )
}
