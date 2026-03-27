import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Truck,
  MapPin,
  Users,
  BarChart3,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Circle,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Navigation,
  Trophy,
  Map,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { deliveryApi } from '@/lib/delivery.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, cn } from '@/lib/utils'
import type {
  Delivery,
  DeliveryZone,
  Driver,
  DeliveryStatus,
  DeliveryAnalytics,
} from '@/types/delivery.types'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<DeliveryStatus, { dot: string; text: string; bg: string; label: string }> = {
  PENDING:    { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Pending'    },
  ASSIGNED:   { dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50',    label: 'Assigned'   },
  PICKED_UP:  { dot: 'bg-indigo-400',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  label: 'Picked Up'  },
  IN_TRANSIT: { dot: 'bg-orange-400',  text: 'text-orange-700',  bg: 'bg-orange-50',  label: 'In Transit' },
  DELIVERED:  { dot: 'bg-green-500',   text: 'text-green-700',   bg: 'bg-green-50',   label: 'Delivered'  },
  FAILED:     { dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50',     label: 'Failed'     },
  CANCELLED:  { dot: 'bg-gray-400',    text: 'text-gray-500',    bg: 'bg-gray-50',    label: 'Cancelled'  },
}

const TERMINAL: DeliveryStatus[] = ['DELIVERED', 'FAILED', 'CANCELLED']

const MANAGER_TRANSITIONS: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  PENDING:    ['ASSIGNED', 'FAILED', 'CANCELLED'],
  ASSIGNED:   ['PICKED_UP', 'FAILED', 'CANCELLED'],
  PICKED_UP:  ['IN_TRANSIT', 'FAILED', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED', 'CANCELLED'],
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: DeliveryStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
      <span className={cn('text-xs font-medium', s.text)}>{s.label}</span>
    </span>
  )
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function addressPreview(addr: Delivery['order']) {
  if (!addr?.deliveryAddress) return '—'
  const a = addr.deliveryAddress
  return [a.line1, a.area, a.city].filter(Boolean).join(', ') || '—'
}

function NativeSelect({
  value,
  onChange,
  children,
  className,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-full appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Zone form dialog ──────────────────────────────────────────────────────────

const zoneSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  radiusKm: z.number({ coerce: true }).min(0.1, 'Minimum 0.1 km'),
  extraFee: z.number({ coerce: true }).min(0).optional(),
})
type ZoneForm = z.infer<typeof zoneSchema>

function ZoneFormDialog({
  zone,
  restaurantId,
  onClose,
  onSaved,
}: {
  zone?: DeliveryZone
  restaurantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<ZoneForm>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name:     zone?.name ?? '',
      radiusKm: zone?.radiusKm ?? 1,
      extraFee: Number(zone?.extraFee ?? 0),
    },
  })

  const createMutation = useMutation({
    mutationFn: (dto: ZoneForm) =>
      deliveryApi.createZone(restaurantId, { ...dto, extraFee: dto.extraFee ?? 0 }),
    onSuccess: () => { toast.success('Zone created'); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (dto: ZoneForm) =>
      deliveryApi.updateZone(restaurantId, zone!.id, { ...dto, extraFee: dto.extraFee ?? 0 }),
    onSuccess: () => { toast.success('Zone updated'); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function onSubmit(data: ZoneForm) {
    zone ? updateMutation.mutate(data) : createMutation.mutate(data)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{zone ? 'Edit Zone' : 'Add Delivery Zone'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Zone Name *</Label>
            <Input {...register('name')} placeholder="Downtown, Airport, Suburbs…" />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Radius (km) *</Label>
            <Input type="number" step="0.1" min="0.1" {...register('radiusKm')} />
            {errors.radiusKm && <p className="text-xs text-red-500">{errors.radiusKm.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Extra Delivery Fee (BDT)</Label>
            <Input type="number" step="1" min="0" {...register('extraFee')} placeholder="0" />
            {errors.extraFee && <p className="text-xs text-red-500">{errors.extraFee.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={isPending}>
              {zone ? 'Save Changes' : 'Create Zone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create driver dialog ──────────────────────────────────────────────────────

const driverSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  email:     z.string().email('Valid email required'),
  phone:     z.string().optional(),
  password:  z.string().min(8, 'Minimum 8 characters'),
})
type DriverForm = z.infer<typeof driverSchema>

function CreateDriverDialog({
  restaurantId,
  onClose,
  onSaved,
}: {
  restaurantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<DriverForm>({
    resolver: zodResolver(driverSchema),
  })

  const mutation = useMutation({
    mutationFn: (dto: DriverForm) => deliveryApi.createDriver(restaurantId, dto),
    onSuccess: () => { toast.success('Driver account created'); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Driver</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register('phone')} placeholder="01XXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label>Password *</Label>
            <Input type="password" {...register('password')} placeholder="Min 8 characters" />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={mutation.isPending}>Create Driver</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create delivery dialog ────────────────────────────────────────────────────

const createDeliverySchema = z.object({
  orderId:     z.string().uuid('Must be a valid order ID'),
  driverId:    z.string().optional(),
  zoneId:      z.string().optional(),
  estimatedAt: z.string().optional(),
  notes:       z.string().optional(),
})
type CreateDeliveryForm = z.infer<typeof createDeliverySchema>

function CreateDeliveryDialog({
  restaurantId,
  drivers,
  zones,
  onClose,
  onSaved,
}: {
  restaurantId: string
  drivers: Driver[]
  zones: DeliveryZone[]
  onClose: () => void
  onSaved: () => void
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateDeliveryForm>({
    resolver: zodResolver(createDeliverySchema),
  })

  const mutation = useMutation({
    mutationFn: (dto: CreateDeliveryForm) =>
      deliveryApi.createDelivery(restaurantId, {
        orderId: dto.orderId,
        driverId: dto.driverId || undefined,
        zoneId: dto.zoneId || undefined,
        estimatedAt: dto.estimatedAt || undefined,
        notes: dto.notes || undefined,
      }),
    onSuccess: () => { toast.success('Delivery created'); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Delivery</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Order ID *</Label>
            <Input {...register('orderId')} placeholder="Paste the order UUID" className="font-mono text-xs" />
            <p className="text-xs text-gray-400">Copy the order UUID from the Orders page (DELIVERY or ONLINE orders only)</p>
            {errors.orderId && <p className="text-xs text-red-500">{errors.orderId.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Assign Driver (optional)</Label>
            <div className="relative">
              <select
                {...register('driverId')}
                className="h-9 w-full appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— unassigned —</option>
                {drivers.filter((d) => d.isActive).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName}{d.isOnline ? ' 🟢' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Delivery Zone (optional)</Label>
            <div className="relative">
              <select
                {...register('zoneId')}
                className="h-9 w-full appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— no zone —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.radiusKm} km)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Estimated Delivery Time</Label>
            <Input type="datetime-local" {...register('estimatedAt')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} {...register('notes')} placeholder="Special instructions…" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={mutation.isPending}>Create Delivery</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assign driver dialog ──────────────────────────────────────────────────────

function AssignDriverDialog({
  delivery,
  restaurantId,
  drivers,
  onClose,
  onSaved,
}: {
  delivery: Delivery
  restaurantId: string
  drivers: Driver[]
  onClose: () => void
  onSaved: () => void
}) {
  const [driverId, setDriverId] = useState(delivery.driverId ?? '')
  const [estimatedAt, setEstimatedAt] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      deliveryApi.assignDriver(restaurantId, delivery.id, {
        driverId,
        estimatedAt: estimatedAt || undefined,
      }),
    onSuccess: () => { toast.success('Driver assigned'); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {delivery.driverId ? 'Reassign Driver' : 'Assign Driver'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Order</Label>
            <p className="text-sm font-medium text-gray-900">
              {delivery.order?.orderNumber ?? delivery.orderId.slice(-8)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Driver *</Label>
            <NativeSelect value={driverId} onChange={setDriverId}>
              <option value="">— select driver —</option>
              {drivers.filter((d) => d.isActive).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                  {d.isOnline ? ' 🟢' : ' ⚫'}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Estimated Delivery Time</Label>
            <Input
              type="datetime-local"
              value={estimatedAt}
              onChange={(e) => setEstimatedAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button
            loading={mutation.isPending}
            disabled={!driverId}
            onClick={() => mutation.mutate()}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Status update dialog ──────────────────────────────────────────────────────

function StatusUpdateDialog({
  delivery,
  restaurantId,
  onClose,
  onSaved,
}: {
  delivery: Delivery
  restaurantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const allowed = MANAGER_TRANSITIONS[delivery.status] ?? []
  const [status, setStatus] = useState<DeliveryStatus>(allowed[0] ?? delivery.status)
  const [failReason, setFailReason] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      deliveryApi.updateStatus(restaurantId, delivery.id, {
        status,
        failReason: failReason || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => { toast.success(`Status updated to ${STATUS_STYLE[status].label}`); onSaved() },
    onError: (err) => toast.error(apiError(err)),
  })

  if (allowed.length === 0) return null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Delivery Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <StatusDot status={delivery.status} />
            <span className="text-gray-400">→</span>
          </div>
          <div className="space-y-1.5">
            <Label>New Status *</Label>
            <NativeSelect value={status} onChange={(v) => setStatus(v as DeliveryStatus)}>
              {allowed.map((s) => (
                <option key={s} value={s}>{STATUS_STYLE[s].label}</option>
              ))}
            </NativeSelect>
          </div>
          {status === 'FAILED' && (
            <div className="space-y-1.5">
              <Label>Fail Reason</Label>
              <Textarea
                rows={2}
                placeholder="Describe why the delivery failed…"
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="Any additional notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button
            loading={mutation.isPending}
            variant={status === 'CANCELLED' || status === 'FAILED' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
          >
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delivery detail dialog ────────────────────────────────────────────────────

function DeliveryDetailDialog({
  delivery,
  restaurantId,
  drivers,
  onClose,
  onMutated,
}: {
  delivery: Delivery
  restaurantId: string
  drivers: Driver[]
  onClose: () => void
  onMutated: () => void
}) {
  const [showAssign, setShowAssign] = useState(false)
  const [showStatus, setShowStatus] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ['delivery', 'detail', restaurantId, delivery.id],
    queryFn: () => deliveryApi.getDelivery(restaurantId, delivery.id),
    initialData: delivery,
  })

  const { data: location } = useQuery({
    queryKey: ['delivery', 'location', restaurantId, delivery.id],
    queryFn: () => deliveryApi.getDriverLocation(restaurantId, delivery.id),
    enabled: !!detail.driverId,
    refetchInterval: 15_000,
  })

  const d = detail
  const isTerminal = TERMINAL.includes(d.status)
  const canAssign = !isTerminal
  const allowedTransitions = MANAGER_TRANSITIONS[d.status] ?? []

  const TIMELINE = [
    { label: 'Created',    ts: d.createdAt,    status: 'PENDING' as DeliveryStatus },
    { label: 'Assigned',   ts: d.assignedAt,   status: 'ASSIGNED' as DeliveryStatus },
    { label: 'Picked Up',  ts: d.pickedUpAt,   status: 'PICKED_UP' as DeliveryStatus },
    { label: 'In Transit', ts: d.inTransitAt,  status: 'IN_TRANSIT' as DeliveryStatus },
    { label: 'Delivered',  ts: d.deliveredAt,  status: 'DELIVERED' as DeliveryStatus },
    { label: 'Failed',     ts: d.failedAt,     status: 'FAILED' as DeliveryStatus },
    { label: 'Cancelled',  ts: d.cancelledAt,  status: 'CANCELLED' as DeliveryStatus },
  ].filter((t) => !!t.ts)

  function handleMutated() {
    setShowAssign(false)
    setShowStatus(false)
    onMutated()
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-500">
                #{d.id.slice(-8).toUpperCase()}
              </span>
              <StatusDot status={d.status} />
            </DialogTitle>
          </DialogHeader>

          {/* Order info */}
          <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span className="font-semibold">{d.order?.orderNumber ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-semibold">{d.order ? formatCurrency(Number(d.order.totalAmount)) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Address</span>
              <span className="text-right max-w-[60%]">{addressPreview(d.order)}</span>
            </div>
            {d.estimatedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">ETA</span>
                <span>{fmtTime(d.estimatedAt)}</span>
              </div>
            )}
            {d.zone && (
              <div className="flex justify-between">
                <span className="text-gray-500">Zone</span>
                <span>{d.zone.name}</span>
              </div>
            )}
          </div>

          {/* Driver info */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Driver</span>
              {canAssign && (
                <Button size="sm" variant="outline" onClick={() => setShowAssign(true)}>
                  {d.driver ? 'Reassign' : 'Assign Driver'}
                </Button>
              )}
            </div>
            {d.driver ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-semibold">
                  {d.driver.firstName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{d.driver.firstName} {d.driver.lastName}</p>
                  {d.driver.phone && <p className="text-xs text-gray-400">{d.driver.phone}</p>}
                </div>
                {location && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-full', location.isOnline ? 'bg-green-500' : 'bg-gray-300')} />
                    <span className="text-xs text-gray-500">{location.isOnline ? 'Online' : 'Offline'}</span>
                    {location.lastLocation && (
                      <span className="text-xs text-gray-400">
                        · {new Date(location.lastLocation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No driver assigned</p>
            )}
          </div>

          {/* Fail reason */}
          {d.failReason && (
            <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {d.failReason}
            </div>
          )}

          {/* Notes */}
          {d.notes && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {d.notes}
            </div>
          )}

          {/* Timeline */}
          {TIMELINE.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Timeline</p>
              <div className="space-y-2">
                {TIMELINE.map((t, i) => (
                  <div key={t.status} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn('w-2 h-2 rounded-full mt-1 flex-shrink-0', STATUS_STYLE[t.status].dot)} />
                      {i < TIMELINE.length - 1 && (
                        <span className="w-px flex-1 bg-gray-200 mt-1 min-h-[16px]" />
                      )}
                    </div>
                    <div className="pb-2">
                      <span className={cn('text-xs font-semibold', STATUS_STYLE[t.status].text)}>{t.label}</span>
                      <p className="text-xs text-gray-400">{fmtTime(t.ts)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proof */}
          {(d.proofUrl || d.proofNotes) && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Delivery Proof</p>
              {d.proofUrl && (
                <a href={d.proofUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline break-all">
                  View photo
                </a>
              )}
              {d.proofNotes && <p className="text-sm text-green-800">{d.proofNotes}</p>}
            </div>
          )}

          {/* Actions */}
          {!isTerminal && allowedTransitions.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatus(true)}>
                Change Status
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {showAssign && (
        <AssignDriverDialog
          delivery={d}
          restaurantId={restaurantId}
          drivers={drivers}
          onClose={() => setShowAssign(false)}
          onSaved={handleMutated}
        />
      )}

      {showStatus && (
        <StatusUpdateDialog
          delivery={d}
          restaurantId={restaurantId}
          onClose={() => setShowStatus(false)}
          onSaved={handleMutated}
        />
      )}
    </>
  )
}

// ─── Delivery row ──────────────────────────────────────────────────────────────

function DeliveryRow({
  delivery,
  onOpen,
  onAssign,
  onStatus,
}: {
  delivery: Delivery
  onOpen: () => void
  onAssign: () => void
  onStatus: () => void
}) {
  const isTerminal = TERMINAL.includes(delivery.status)
  const allowedTransitions = MANAGER_TRANSITIONS[delivery.status] ?? []

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-white hover:bg-surface-subtle transition-colors cursor-pointer group"
      onClick={onOpen}
    >
      {/* Order */}
      <div className="w-28 flex-shrink-0">
        <p className="font-semibold text-sm text-gray-900">
          {delivery.order?.orderNumber ?? '—'}
        </p>
        <p className="text-xs text-gray-400 font-mono">#{delivery.id.slice(-6).toUpperCase()}</p>
      </div>

      {/* Address */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate">{addressPreview(delivery.order)}</p>
        {delivery.zone && (
          <p className="text-xs text-gray-400 truncate">{delivery.zone.name}</p>
        )}
      </div>

      {/* Driver */}
      <div className="w-32 flex-shrink-0">
        {delivery.driver ? (
          <p className="text-sm text-gray-700 truncate">
            {delivery.driver.firstName} {delivery.driver.lastName}
          </p>
        ) : (
          <span className="text-xs text-amber-600 font-medium">Unassigned</span>
        )}
      </div>

      {/* Status */}
      <div className="w-28 flex-shrink-0">
        <StatusDot status={delivery.status} />
      </div>

      {/* ETA */}
      <div className="w-32 flex-shrink-0 text-xs text-gray-400">
        {delivery.estimatedAt ? fmtTime(delivery.estimatedAt) : '—'}
      </div>

      {/* Actions */}
      <div
        className="flex-shrink-0 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {!isTerminal && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Actions
                <ChevronDown size={12} className="ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAssign}>
                <UserCircle size={14} className="mr-2" />
                {delivery.driverId ? 'Reassign Driver' : 'Assign Driver'}
              </DropdownMenuItem>
              {allowedTransitions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onStatus}>
                    <Package size={14} className="mr-2" />
                    Update Status
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ─── Deliveries tab ────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_STYLE).map(([v, s]) => ({ value: v, label: s.label })),
]

function DeliveriesTab({
  restaurantId,
  drivers,
  zones,
}: {
  restaurantId: string
  drivers: Driver[]
  zones: DeliveryZone[]
}) {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [driverFilter, setDriverFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const [actionDelivery, setActionDelivery] = useState<{ delivery: Delivery; type: 'assign' | 'status' } | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const params = {
    page,
    limit: 20,
    ...(statusFilter && { status: statusFilter as DeliveryStatus }),
    ...(driverFilter && { driverId: driverFilter }),
    ...(dateFilter && { date: dateFilter }),
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['deliveries', restaurantId, params],
    queryFn: () => deliveryApi.listDeliveries(restaurantId, params),
    enabled: !!restaurantId,
    refetchInterval: 20_000,
  })

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['deliveries', restaurantId] }),
    [qc, restaurantId],
  )

  const deliveries = data?.data ?? []
  const pagination = data?.pagination
  const totalPages = pagination?.pages ?? 1

  function clearFilters() {
    setStatusFilter(''); setDriverFilter(''); setDateFilter(''); setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <NativeSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} className="w-40">
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </NativeSelect>

        <NativeSelect value={driverFilter} onChange={(v) => { setDriverFilter(v); setPage(1) }} className="w-44">
          <option value="">All Drivers</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
          ))}
        </NativeSelect>

        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
          className="h-9 w-40"
        />

        {(statusFilter || driverFilter || dateFilter) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
        )}

        <span className="text-xs text-gray-400 ml-auto">
          {isFetching && !isLoading ? 'Refreshing…' : pagination ? `${pagination.total} deliveries` : ''}
        </span>

        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} />
          New Delivery
        </Button>
      </div>

      {/* Column headers */}
      {!isLoading && deliveries.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <div className="w-28">Order</div>
          <div className="flex-1">Address</div>
          <div className="w-32">Driver</div>
          <div className="w-28">Status</div>
          <div className="w-32">ETA</div>
          <div className="w-20" />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && deliveries.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-2 text-center">
            <Truck size={32} className="text-gray-300" />
            <p className="font-medium text-gray-700 mt-2">No deliveries found</p>
            <p className="text-sm text-gray-400">Create a delivery to get started</p>
            <Button size="sm" className="mt-2" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              New Delivery
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delivery list */}
      {!isLoading && deliveries.length > 0 && (
        <div className="space-y-1.5">
          {deliveries.map((delivery) => (
            <DeliveryRow
              key={delivery.id}
              delivery={delivery}
              onOpen={() => setSelectedDelivery(delivery)}
              onAssign={() => setActionDelivery({ delivery, type: 'assign' })}
              onStatus={() => setActionDelivery({ delivery, type: 'status' })}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={14} />
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
            <Button
              key={i + 1}
              variant={page === i + 1 ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 text-xs"
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
          {totalPages > 7 && <span className="text-gray-400 text-sm">…{totalPages}</span>}
          <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <CreateDeliveryDialog
          restaurantId={restaurantId}
          drivers={drivers}
          zones={zones}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate() }}
        />
      )}

      {selectedDelivery && (
        <DeliveryDetailDialog
          delivery={selectedDelivery}
          restaurantId={restaurantId}
          drivers={drivers}
          onClose={() => setSelectedDelivery(null)}
          onMutated={() => { setSelectedDelivery(null); invalidate() }}
        />
      )}

      {actionDelivery?.type === 'assign' && (
        <AssignDriverDialog
          delivery={actionDelivery.delivery}
          restaurantId={restaurantId}
          drivers={drivers}
          onClose={() => setActionDelivery(null)}
          onSaved={() => { setActionDelivery(null); invalidate() }}
        />
      )}

      {actionDelivery?.type === 'status' && (
        <StatusUpdateDialog
          delivery={actionDelivery.delivery}
          restaurantId={restaurantId}
          onClose={() => setActionDelivery(null)}
          onSaved={() => { setActionDelivery(null); invalidate() }}
        />
      )}
    </div>
  )
}

// ─── Zones tab ─────────────────────────────────────────────────────────────────

function ZonesTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [editZone, setEditZone] = useState<DeliveryZone | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['delivery', 'zones', restaurantId],
    queryFn: () => deliveryApi.listZones(restaurantId),
    enabled: !!restaurantId,
  })

  const deleteMutation = useMutation({
    mutationFn: (zoneId: string) => deliveryApi.deleteZone(restaurantId, zoneId),
    onSuccess: () => {
      toast.success('Zone deactivated')
      qc.invalidateQueries({ queryKey: ['delivery', 'zones', restaurantId] })
    },
    onError: (err) => toast.error(apiError(err)),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['delivery', 'zones', restaurantId] })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{zones.length} zone{zones.length !== 1 ? 's' : ''} configured</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} />
          Add Zone
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {!isLoading && zones.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <MapPin size={28} className="text-gray-300" />
            <p className="font-medium text-gray-700">No delivery zones</p>
            <p className="text-sm text-gray-400">Add zones to define your delivery areas</p>
            <Button size="sm" className="mt-2" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Add First Zone
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && zones.length > 0 && (
        <div className="space-y-2">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-white"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Map size={16} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">{zone.name}</p>
                  <Badge variant={zone.isActive ? 'default' : 'secondary'} className="text-2xs">
                    {zone.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  Radius: {zone.radiusKm} km
                  {Number(zone.extraFee) > 0 && ` · Extra fee: ${formatCurrency(Number(zone.extraFee))}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditZone(zone)}
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(zone.id)}
                >
                  {!deleteMutation.isPending && <Trash2 size={13} />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ZoneFormDialog
          restaurantId={restaurantId}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate() }}
        />
      )}

      {editZone && (
        <ZoneFormDialog
          zone={editZone}
          restaurantId={restaurantId}
          onClose={() => setEditZone(null)}
          onSaved={() => { setEditZone(null); invalidate() }}
        />
      )}
    </div>
  )
}

// ─── Drivers tab ───────────────────────────────────────────────────────────────

function DriversTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['delivery', 'drivers', restaurantId],
    queryFn: () => deliveryApi.listDrivers(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  })

  const toggleMutation = useMutation({
    mutationFn: (driverId: string) => deliveryApi.toggleDriver(restaurantId, driverId),
    onSuccess: (d) => {
      toast.success(`Driver ${d.isActive ? 'activated' : 'deactivated'}`)
      qc.invalidateQueries({ queryKey: ['delivery', 'drivers', restaurantId] })
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const online = drivers.filter((d) => d.isOnline).length
  const active = drivers.filter((d) => d.isActive).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{active} active</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {online} online now
          </span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={15} />
          Add Driver
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {!isLoading && drivers.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <Users size={28} className="text-gray-300" />
            <p className="font-medium text-gray-700">No drivers yet</p>
            <p className="text-sm text-gray-400">Add driver accounts to assign deliveries</p>
            <Button size="sm" className="mt-2" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Add First Driver
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && drivers.length > 0 && (
        <div className="space-y-2">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-white',
                !driver.isActive && 'opacity-60',
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                  {driver.firstName[0]}{driver.lastName[0]}
                </div>
                {driver.isActive && (
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                      driver.isOnline ? 'bg-green-500' : 'bg-gray-300',
                    )}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">
                    {driver.firstName} {driver.lastName}
                  </p>
                  {!driver.isActive && (
                    <Badge variant="secondary" className="text-2xs">Inactive</Badge>
                  )}
                  {driver.isActive && driver.isOnline && (
                    <span className="text-2xs text-green-600 font-medium">Online</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {driver.email}
                  {driver.phone && ` · ${driver.phone}`}
                </p>
              </div>

              {/* Toggle */}
              <button
                title={driver.isActive ? 'Deactivate' : 'Activate'}
                onClick={() => toggleMutation.mutate(driver.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                {driver.isActive ? (
                  <ToggleRight size={22} className="text-green-500" />
                ) : (
                  <ToggleLeft size={22} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDriverDialog
          restaurantId={restaurantId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['delivery', 'drivers', restaurantId] })
          }}
        />
      )}
    </div>
  )
}

// ─── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ restaurantId }: { restaurantId: string }) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const params = {
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['delivery', 'analytics', restaurantId, params],
    queryFn: () => deliveryApi.getAnalytics(restaurantId, params),
    enabled: !!restaurantId,
    staleTime: 2 * 60 * 1000,
  })

  const totalDeliveries = (data?.deliveriesByStatus ?? []).reduce((s, g) => s + g.count, 0)

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-2">
        <div className="space-y-0.5">
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-sm" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-sm" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setDateFrom(''); setDateTo('') }}>
            Clear
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Success Rate</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{data.successRatePercent}%</p>
                    <p className="text-xs text-gray-400 mt-1">{totalDeliveries} total deliveries</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Avg. Delivery Time</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{data.avgDeliveryMinutes}</p>
                    <p className="text-xs text-gray-400 mt-1">minutes (assigned → delivered)</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Clock size={18} className="text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active Deliveries</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {(data.deliveriesByStatus.find((g) => g.status === 'IN_TRANSIT')?.count ?? 0) +
                       (data.deliveriesByStatus.find((g) => g.status === 'PICKED_UP')?.count ?? 0)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">in transit / picked up</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Navigation size={18} className="text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Status breakdown */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Deliveries by Status</p>
              {data.deliveriesByStatus.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No data for this period</p>
              ) : (
                <div className="space-y-2">
                  {data.deliveriesByStatus.map((g) => {
                    const pct = totalDeliveries > 0 ? Math.round((g.count / totalDeliveries) * 100) : 0
                    const s = STATUS_STYLE[g.status]
                    return (
                      <div key={g.status} className="flex items-center gap-3">
                        <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', s.dot)} />
                        <span className="text-sm text-gray-700 w-24">{s.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', s.dot)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8 text-right">{g.count}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Driver leaderboard */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-500" />
                Driver Leaderboard
              </p>
              {data.driverLeaderboard.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No completed deliveries</p>
              ) : (
                <div className="space-y-2">
                  {data.driverLeaderboard.map((d, i) => (
                    <div key={d.driverId} className="flex items-center gap-3 py-1.5">
                      <span className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold',
                        i === 0 ? 'bg-amber-100 text-amber-600' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-surface-subtle text-gray-400',
                      )}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-700">{d.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{d.deliveries}</span>
                      <span className="text-xs text-gray-400">deliveries</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Zone coverage */}
          {data.zoneCoverage.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Zone Coverage</p>
              <div className="grid grid-cols-2 gap-2">
                {data.zoneCoverage.map((z) => (
                  <div
                    key={z.zoneId ?? 'none'}
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <Map size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{z.zoneName}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{z.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'deliveries' | 'zones' | 'drivers' | 'analytics'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'deliveries', label: 'Deliveries',  icon: Truck    },
  { id: 'zones',      label: 'Zones',       icon: MapPin   },
  { id: 'drivers',    label: 'Drivers',     icon: Users    },
  { id: 'analytics',  label: 'Analytics',   icon: BarChart3 },
]

export default function DeliveryPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [activeTab, setActiveTab] = useState<TabId>('deliveries')

  // Pre-fetch zones and drivers for use across tabs
  const { data: zones = [] } = useQuery({
    queryKey: ['delivery', 'zones', restaurantId],
    queryFn: () => deliveryApi.listZones(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: drivers = [] } = useQuery({
    queryKey: ['delivery', 'drivers', restaurantId],
    queryFn: () => deliveryApi.listDrivers(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  })

  return (
    <PageShell
      title="Delivery Management"
      breadcrumbs={[{ label: 'Delivery' }]}
    >
      {!restaurantId && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No restaurant linked to your account.
          </CardContent>
        </Card>
      )}

      {restaurantId && (
        <div className="space-y-5">
          {/* Tab navigation */}
          <div className="flex items-center gap-1 border-b border-border">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === id
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
          {activeTab === 'deliveries' && (
            <DeliveriesTab restaurantId={restaurantId} drivers={drivers} zones={zones} />
          )}
          {activeTab === 'zones' && (
            <ZonesTab restaurantId={restaurantId} />
          )}
          {activeTab === 'drivers' && (
            <DriversTab restaurantId={restaurantId} />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab restaurantId={restaurantId} />
          )}
        </div>
      )}
    </PageShell>
  )
}
