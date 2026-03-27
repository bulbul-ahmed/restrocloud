import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  TableProperties,
  Check,
  X,
  ChevronDown,
  ReceiptText,
  AlertCircle,
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

import { ordersApi } from '@/lib/orders.api'
import { settingsApi } from '@/lib/settings.api'
import { getSocket } from '@/lib/socket'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, cn } from '@/lib/utils'
import type { Order, OrderStatus, OrderChannel } from '@/types/order.types'

// ─── Audio chime (Web Audio API — no file dependency) ─────────────────────────

function playOrderChime() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, ctx.currentTime)

    // Three ascending tones: D5 → F#5 → A5
    const notes = [587, 740, 880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      const start = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.25, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.start(start)
      osc.stop(start + 0.35)
    })

    // Close context after all tones finish
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // Browser may block AudioContext before user gesture — silently ignore
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<OrderStatus, { dot: string; text: string; bg: string }> = {
  PENDING:   { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  ACCEPTED:  { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  PREPARING: { dot: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  READY:     { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
  SERVED:    { dot: 'bg-teal-400',   text: 'text-teal-700',   bg: 'bg-teal-50'   },
  COMPLETED: { dot: 'bg-gray-400',   text: 'text-gray-600',   bg: 'bg-gray-50'   },
  CANCELLED: { dot: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50'    },
  REFUNDED:  { dot: 'bg-purple-400', text: 'text-purple-700', bg: 'bg-purple-50' },
}

const CHANNEL_LABEL: Record<OrderChannel, string> = {
  DINE_IN:    'Dine-in',
  TAKEAWAY:   'Takeaway',
  DELIVERY:   'Delivery',
  QR:         'QR',
  ONLINE:     'Online',
  KIOSK:      'Kiosk',
  AGGREGATOR: 'Aggregator',
}

// Valid next statuses per current status
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING:   ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:  ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY:     ['SERVED', 'COMPLETED'],
  SERVED:    ['COMPLETED'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
      <span className={cn('text-xs font-medium', s.text)}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    </span>
  )
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function customerName(order: Order): string {
  if (order.customer) return `${order.customer.firstName} ${order.customer.lastName}`
  if (order.guestName) return order.guestName
  if (order.createdBy) return `${order.createdBy.firstName} ${order.createdBy.lastName}`
  return '—'
}

// ─── Native styled select ─────────────────────────────────────────────────────

function NativeSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Reject / Cancel dialog ───────────────────────────────────────────────────

function ReasonDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'destructive',
  onConfirm,
  onClose,
  loading,
}: {
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: 'destructive' | 'default'
  onConfirm: (reason: string) => void
  onClose: () => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">{description}</p>
        <div className="space-y-1.5">
          <Label>Reason (optional)</Label>
          <Textarea
            rows={2}
            placeholder="Enter reason…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button
            variant={confirmVariant}
            loading={loading}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Order detail dialog ──────────────────────────────────────────────────────

function OrderDetailDialog({
  order,
  restaurantId,
  onClose,
  onMutated,
}: {
  order: Order
  restaurantId: string
  onClose: () => void
  onMutated: () => void
}) {
  const qc = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<
    'reject' | 'cancel' | { status: OrderStatus } | null
  >(null)

  // Full detail fetch (includes statusHistory)
  const { data: detail } = useQuery({
    queryKey: ['orders', 'detail', restaurantId, order.id],
    queryFn: () => ordersApi.get(restaurantId, order.id),
    initialData: order,
  })

  const refreshDetail = () => qc.invalidateQueries({ queryKey: ['orders', 'detail', restaurantId, order.id] })

  const acceptMutation = useMutation({
    mutationFn: () => ordersApi.accept(restaurantId, order.id),
    onSuccess: () => { toast.success('Order accepted'); refreshDetail(); onMutated() },
    onError: (err) => toast.error(apiError(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.reject(restaurantId, order.id, reason || undefined),
    onSuccess: () => { toast.success('Order rejected'); setConfirmAction(null); onMutated(); onClose() },
    onError: (err) => toast.error(apiError(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(restaurantId, order.id, reason || undefined),
    onSuccess: () => { toast.success('Order cancelled'); setConfirmAction(null); onMutated(); onClose() },
    onError: (err) => toast.error(apiError(err)),
  })

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.updateStatus(restaurantId, order.id, status),
    onSuccess: (updated) => {
      toast.success(`Order → ${updated.status.charAt(0) + updated.status.slice(1).toLowerCase()}`)
      setConfirmAction(null)
      refreshDetail()
      onMutated()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const d = detail
  const activeItems = d.items.filter((i) => !i.isVoid)
  const voidedItems = d.items.filter((i) => i.isVoid)
  const nextStatuses = NEXT_STATUS[d.status] ?? []
  const isPending = d.status === 'PENDING'
  const isTerminal = ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(d.status)

  const history = [...(d.statusHistory ?? [])].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  )

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="px-5 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <span>{d.orderNumber}</span>
              <StatusDot status={d.status} />
              <span className="text-sm font-normal text-gray-500">
                {CHANNEL_LABEL[d.channel]}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Two-column body */}
          <div className="flex min-h-0" style={{ maxHeight: 'calc(90vh - 110px)' }}>

            {/* ── Left: order details ── */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-border">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={13} className="text-gray-400" />
                    {fmtTime(d.createdAt)}
                  </div>
                  {d.table && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <TableProperties size={13} className="text-gray-400" />
                      Table {d.table.tableNumber}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <User size={13} className="text-gray-400" />
                    {customerName(d)}
                  </div>
                  {d.aggregatorName && (
                    <div className="text-gray-600">
                      Via <span className="font-medium capitalize">{d.aggregatorName}</span>
                      {d.externalOrderId && (
                        <span className="text-gray-400 text-xs ml-1">#{d.externalOrderId}</span>
                      )}
                    </div>
                  )}
                </div>

                {d.notes && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                    {d.notes}
                  </div>
                )}

                {d.cancelReason && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    Cancelled: {d.cancelReason}
                  </div>
                )}

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Items ({activeItems.length})
                  </p>
                  <div className="space-y-0">
                    {activeItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-2 py-2 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">
                            {item.quantity}× {item.name}
                          </span>
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              +{item.modifiers.map((m) => m.name).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-600 italic mt-0.5">{item.notes}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium">{formatCurrency(Number(item.totalPrice))}</p>
                          <p className="text-xs text-gray-400">{formatCurrency(Number(item.unitPrice))} ea</p>
                        </div>
                      </div>
                    ))}
                    {voidedItems.length > 0 && (
                      <p className="text-xs text-gray-400 pt-1">
                        + {voidedItems.length} voided item{voidedItems.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-lg bg-surface-subtle border border-border p-3 space-y-1 text-sm">
                  {[
                    { label: 'Subtotal', value: d.subtotal },
                    { label: 'Tax', value: d.taxAmount },
                    { label: 'Service Charge', value: d.serviceCharge },
                    { label: 'Tip', value: d.tipAmount },
                    { label: 'Discount', value: d.discountAmount, negative: true },
                  ].map(({ label, value, negative }) =>
                    Number(value) !== 0 ? (
                      <div key={label} className="flex justify-between text-gray-600">
                        <span>{label}</span>
                        <span>{negative ? '−' : ''}{formatCurrency(Number(value))}</span>
                      </div>
                    ) : null,
                  )}
                  <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-border mt-1">
                    <span>Total</span>
                    <span>{formatCurrency(Number(d.totalAmount))}</span>
                  </div>
                </div>
              </div>

              {/* Actions pinned at bottom of left column */}
              {!isTerminal && (
                <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-white">
                  {isPending && (
                    <>
                      <Button variant="destructive" size="sm" onClick={() => setConfirmAction('reject')}>
                        <X size={14} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        loading={acceptMutation.isPending}
                        onClick={() => acceptMutation.mutate()}
                      >
                        <Check size={14} />
                        Accept
                      </Button>
                    </>
                  )}
                  {!isPending &&
                    nextStatuses
                      .filter((s) => s !== 'CANCELLED')
                      .map((s) => (
                        <Button key={s} size="sm" loading={statusMutation.isPending} onClick={() => statusMutation.mutate(s)}>
                          → {s.charAt(0) + s.slice(1).toLowerCase()}
                        </Button>
                      ))}
                  {nextStatuses.includes('CANCELLED') && (
                    <Button variant="outline" size="sm" onClick={() => setConfirmAction('cancel')}>
                      Cancel Order
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ── Right: status history ── */}
            <div className="w-52 flex-shrink-0 flex flex-col bg-surface-subtle">
              <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
                History
              </p>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No history yet</p>
                ) : (
                  <div className="space-y-0">
                    {history.map((h, i) => (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={cn('w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0', STATUS_STYLE[h.status]?.dot ?? 'bg-gray-300')} />
                          {i < history.length - 1 && (
                            <span className="w-px flex-1 bg-gray-200 my-1 min-h-[20px]" />
                          )}
                        </div>
                        <div className="pb-3 min-w-0">
                          <p className={cn('text-xs font-semibold', STATUS_STYLE[h.status]?.text)}>
                            {h.status.charAt(0) + h.status.slice(1).toLowerCase()}
                          </p>
                          {h.note && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{h.note}</p>
                          )}
                          <p className="text-2xs text-gray-400 mt-0.5">{fmtTime(h.changedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Reject confirmation */}
      {confirmAction === 'reject' && (
        <ReasonDialog
          title="Reject Order"
          description={`Reject ${d.orderNumber}? The order will be cancelled.`}
          confirmLabel="Reject Order"
          onConfirm={(r) => rejectMutation.mutate(r)}
          onClose={() => setConfirmAction(null)}
          loading={rejectMutation.isPending}
        />
      )}

      {/* Cancel confirmation */}
      {confirmAction === 'cancel' && (
        <ReasonDialog
          title="Cancel Order"
          description={`Cancel ${d.orderNumber}?`}
          confirmLabel="Cancel Order"
          onConfirm={(r) => cancelMutation.mutate(r)}
          onClose={() => setConfirmAction(null)}
          loading={cancelMutation.isPending}
        />
      )}
    </>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onOpen,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  order: Order
  onOpen: () => void
  onAccept: () => void
  onReject: () => void
  accepting: boolean
  rejecting: boolean
}) {
  const isPending = order.status === 'PENDING'

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-white hover:bg-surface-subtle transition-colors group cursor-pointer"
      onClick={onOpen}
    >
      {/* Order number + channel */}
      <div className="w-28 flex-shrink-0">
        <p className="font-semibold text-gray-900 text-sm">{order.orderNumber}</p>
        <p className="text-xs text-gray-400">{CHANNEL_LABEL[order.channel]}</p>
      </div>

      {/* Table */}
      <div className="w-16 flex-shrink-0 text-sm text-gray-600">
        {order.table ? `T${order.table.tableNumber}` : '—'}
      </div>

      {/* Customer */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate">{customerName(order)}</p>
        {order.aggregatorName && (
          <p className="text-xs text-gray-400 capitalize">{order.aggregatorName}</p>
        )}
      </div>

      {/* Items count */}
      <div className="w-14 flex-shrink-0 text-sm text-gray-500 text-center">
        {order.items.filter((i) => !i.isVoid).length} items
      </div>

      {/* Total */}
      <div className="w-24 flex-shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-900">
          {formatCurrency(Number(order.totalAmount))}
        </p>
        <p className="text-xs text-gray-400">{order.currency}</p>
      </div>

      {/* Status */}
      <div className="w-28 flex-shrink-0">
        <StatusDot status={order.status} />
      </div>

      {/* Time */}
      <div className="w-28 flex-shrink-0 text-xs text-gray-400">
        {fmtTime(order.createdAt)}
      </div>

      {/* Quick actions for pending */}
      <div
        className="flex-shrink-0 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              title="Reject"
              loading={rejecting}
              disabled={accepting || rejecting}
              onClick={onReject}
              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              {!rejecting && <X size={14} />}
            </Button>
            <Button
              size="icon"
              title="Accept"
              loading={accepting}
              disabled={accepting || rejecting}
              onClick={onAccept}
              className="h-7 w-7 bg-green-600 hover:bg-green-700 text-white"
            >
              {!accepting && <Check size={14} />}
            </Button>
          </>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            title="View details"
            onClick={onOpen}
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ReceiptText size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Pending inbox helpers ────────────────────────────────────────────────────

const CHANNEL_TO_TIMER_KEY: Record<OrderChannel, string> = {
  QR:         'qr',
  ONLINE:     'online',
  AGGREGATOR: 'aggregator',
  DINE_IN:    'pos',
  TAKEAWAY:   'pos',
  DELIVERY:   'online',
  KIOSK:      'pos',
}

function useCountdown(createdAt: string, minutes: number): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (minutes <= 0) {
      setLabel('Manual review')
      return
    }
    const deadline = new Date(createdAt).getTime() + minutes * 60 * 1000
    const tick = () => {
      const remaining = Math.floor((deadline - Date.now()) / 1000)
      if (remaining <= 0) {
        setLabel('Auto-accepting…')
      } else {
        const m = Math.floor(remaining / 60)
        const s = remaining % 60
        setLabel(`Auto-accepts in ${m}:${String(s).padStart(2, '0')}`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt, minutes])

  return label
}

function PendingInboxRow({
  order,
  autoAcceptMinutes,
  onOpen,
  onAccept,
  onRejectClick,
  accepting,
}: {
  order: Order
  autoAcceptMinutes: Record<string, number>
  onOpen: () => void
  onAccept: () => void
  onRejectClick: () => void
  accepting: boolean
}) {
  const timerKey = CHANNEL_TO_TIMER_KEY[order.channel] ?? 'pos'
  const minutes = autoAcceptMinutes[timerKey] ?? 0
  const countdown = useCountdown(order.createdAt, minutes)
  const isOverdue = minutes > 0 && Date.now() > new Date(order.createdAt).getTime() + minutes * 60 * 1000
  const activeItems = order.items.filter((i) => !i.isVoid)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-white hover:bg-amber-50/40 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{order.orderNumber}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
            {CHANNEL_LABEL[order.channel]}
          </span>
          {order.table && (
            <span className="text-xs text-gray-500">Table {order.table.tableNumber}</span>
          )}
          {order.guestName && (
            <span className="text-xs text-gray-500">{order.guestName}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} · {formatCurrency(Number(order.totalAmount))}
        </p>
      </div>

      {/* Countdown */}
      <div
        className={cn(
          'text-xs font-medium flex-shrink-0',
          isOverdue ? 'text-red-600' : minutes > 0 ? 'text-amber-600' : 'text-gray-400',
        )}
      >
        <Clock size={12} className="inline mr-1 mb-0.5" />
        {countdown}
      </div>

      {/* Accept / Reject */}
      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
          onClick={onRejectClick}
        >
          <X size={12} className="mr-1" />
          Reject
        </Button>
        <Button
          size="sm"
          loading={accepting}
          className="h-7 px-2.5 text-xs bg-green-600 hover:bg-green-700 text-white"
          onClick={onAccept}
        >
          {!accepting && <Check size={12} className="mr-1" />}
          Accept
        </Button>
      </div>
    </div>
  )
}

function PendingInbox({
  restaurantId,
  onOrderOpen,
  onMutated,
}: {
  restaurantId: string
  onOrderOpen: (order: Order) => void
  onMutated: () => void
}) {
  const qc = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const { data: pendingData } = useQuery({
    queryKey: ['orders', restaurantId, 'pending-inbox'],
    queryFn: () => ordersApi.list(restaurantId, { status: 'PENDING', limit: 50 }),
    enabled: !!restaurantId,
    refetchInterval: 10_000,
  })

  const { data: timerConfig } = useQuery({
    queryKey: ['settings', restaurantId, 'auto-accept-timer'],
    queryFn: () => settingsApi.getAutoAcceptTimer(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  })

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['orders', restaurantId] })
  }, [qc, restaurantId])

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.accept(restaurantId, orderId),
    onSuccess: () => { toast.success('Order accepted'); invalidate(); onMutated() },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setAcceptingId(null),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      ordersApi.reject(restaurantId, orderId, reason),
    onSuccess: () => { toast.success('Order rejected'); setRejectTarget(null); invalidate(); onMutated() },
    onError: (err) => toast.error(apiError(err)),
  })

  const pendingOrders = pendingData?.orders ?? []
  const autoAcceptMinutes = (timerConfig?.autoAcceptMinutes ?? { pos: 0, qr: 0, online: 0 }) as Record<string, number>

  if (pendingOrders.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
        <span className="text-sm font-semibold text-amber-800">
          Pending Orders — {pendingOrders.length} need{pendingOrders.length === 1 ? 's' : ''} action
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-amber-100">
        {pendingOrders.map((order) => (
          <PendingInboxRow
            key={order.id}
            order={order}
            autoAcceptMinutes={autoAcceptMinutes}
            onOpen={() => onOrderOpen(order)}
            onAccept={() => {
              setAcceptingId(order.id)
              acceptMutation.mutate(order.id)
            }}
            onRejectClick={() => setRejectTarget(order)}
            accepting={acceptingId === order.id && acceptMutation.isPending}
          />
        ))}
      </div>

      {/* Reject dialog */}
      {rejectTarget && (
        <ReasonDialog
          title="Reject Order"
          description={`Reject ${rejectTarget.orderNumber}? The order will be cancelled.`}
          confirmLabel="Reject Order"
          onConfirm={(reason) => rejectMutation.mutate({ orderId: rejectTarget.id, reason: reason || undefined })}
          onClose={() => setRejectTarget(null)}
          loading={rejectMutation.isPending}
        />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'SERVED', label: 'Served' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Channels' },
  { value: 'DINE_IN', label: 'Dine-in' },
  { value: 'TAKEAWAY', label: 'Takeaway' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'QR', label: 'QR' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'AGGREGATOR', label: 'Aggregator' },
]

const SOURCE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pos', label: 'POS' },
  { value: 'qr', label: 'QR' },
  { value: 'online', label: 'Online' },
]

export default function OrdersPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [pendingAction, setPendingAction] = useState<{
    orderId: string
    action: 'accept' | 'reject'
  } | null>(null)

  const queryParams = {
    page,
    limit: 20,
    ...(search && { search }),
    ...(status && { status }),
    ...(channel && { channel }),
    ...(source && { source: source as 'pos' | 'qr' | 'online' }),
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['orders', restaurantId, queryParams],
    queryFn: () => ordersApi.list(restaurantId, queryParams),
    enabled: !!restaurantId,
    refetchInterval: 15_000,
  })

  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['orders', restaurantId] }),
    [qc, restaurantId],
  )

  useEffect(() => {
    if (!restaurantId) return
    const socket = getSocket()
    const refresh = () => qc.invalidateQueries({ queryKey: ['orders', restaurantId] })

    const onNewOrder = () => {
      // Toast + audio handled globally by useOrderNotifications in AppLayout.
      // Only need to refresh the orders list here.
      refresh()
    }

    socket.on('new_order', onNewOrder)
    socket.on('order_status_change', refresh)
    socket.on('payment_processed', refresh)
    return () => {
      socket.off('new_order', onNewOrder)
      socket.off('order_status_change', refresh)
      socket.off('payment_processed', refresh)
    }
  }, [qc, restaurantId])

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.accept(restaurantId, orderId),
    onSuccess: () => { toast.success('Order accepted'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setPendingAction(null),
  })

  const rejectMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.reject(restaurantId, orderId),
    onSuccess: () => { toast.success('Order rejected'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setPendingAction(null),
  })

  function handleFilterChange() {
    setPage(1)
  }

  const orders = data?.orders ?? []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages ?? 1

  return (
    <PageShell
      title="Orders"
      breadcrumbs={[{ label: 'Orders' }]}
    >
      {!restaurantId && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No restaurant linked to your account.
          </CardContent>
        </Card>
      )}

      {restaurantId && (
        <div className="space-y-4">
          {/* Pending inbox */}
          <PendingInbox
            restaurantId={restaurantId}
            onOrderOpen={setSelectedOrder}
            onMutated={invalidate}
          />

          {/* Source tabs */}
          <div className="flex items-center gap-1">
            {SOURCE_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setSource(t.value); handleFilterChange() }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  source === t.value
                    ? 'bg-brand text-white'
                    : 'text-gray-600 hover:bg-surface-subtle',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <Input
                placeholder="Search order # or customer…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleFilterChange() }}
                className="pl-9 h-9"
              />
            </div>
            <NativeSelect
              value={status}
              onChange={(v) => { setStatus(v); handleFilterChange() }}
              className="w-40"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={channel}
              onChange={(v) => { setChannel(v); handleFilterChange() }}
              className="w-40"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
            {(search || status || channel || source) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch(''); setStatus(''); setChannel(''); setSource(''); setPage(1)
                }}
              >
                Clear
              </Button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {isFetching && !isLoading ? 'Refreshing…' : pagination ? `${pagination.total} orders` : ''}
            </span>
          </div>

          {/* Column headers */}
          {!isLoading && orders.length > 0 && (
            <div className="flex items-center gap-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="w-28">Order</div>
              <div className="w-16">Table</div>
              <div className="flex-1">Customer</div>
              <div className="w-14 text-center">Items</div>
              <div className="w-24 text-right">Total</div>
              <div className="w-28">Status</div>
              <div className="w-28">Time</div>
              <div className="w-16" />
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-surface-subtle animate-pulse border border-border" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && orders.length === 0 && (
            <Card>
              <CardContent className="py-16 flex flex-col items-center gap-2 text-center">
                <ReceiptText size={32} className="text-gray-300" />
                <p className="font-medium text-gray-700 mt-2">No orders found</p>
                <p className="text-sm text-gray-400">Try adjusting your filters</p>
              </CardContent>
            </Card>
          )}

          {/* Order list */}
          {!isLoading && orders.length > 0 && (
            <div className="space-y-1.5">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onOpen={() => setSelectedOrder(order)}
                  onAccept={() => {
                    setPendingAction({ orderId: order.id, action: 'accept' })
                    acceptMutation.mutate(order.id)
                  }}
                  onReject={() => {
                    setPendingAction({ orderId: order.id, action: 'reject' })
                    rejectMutation.mutate(order.id)
                  }}
                  accepting={
                    pendingAction?.orderId === order.id &&
                    pendingAction.action === 'accept'
                  }
                  rejecting={
                    pendingAction?.orderId === order.id &&
                    pendingAction.action === 'reject'
                  }
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <Button
                    key={p}
                    variant={page === p ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              })}
              {totalPages > 7 && <span className="text-gray-400 text-sm">…{totalPages}</span>}
              <Button
                variant="outline"
                size="icon"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Order detail */}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          restaurantId={restaurantId}
          onClose={() => setSelectedOrder(null)}
          onMutated={() => {
            invalidate()
          }}
        />
      )}
    </PageShell>
  )
}
