import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  Minus,
  Trash2,
  Search,
  CreditCard,
  Tag,
  RefreshCw,
  ChevronRight,
  Brush,
  ReceiptText,
  X,
  CircleDot,
  Zap,
  ArrowLeftRight,
  WifiOff,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { posApi } from '@/lib/pos.api'
import { menuApi } from '@/lib/menu.api'
import { crmApi } from '@/lib/crm.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { getSocket } from '@/lib/socket'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { posDb } from '@/lib/pos.db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ModifierModal } from './ModifierModal'
import type {
  POSTableSummary,
  POSSection,
  POSOverview,
  CurrentSession,
  SessionOrder,
  CartItem,
  CartModifier,
  TableStatus,
} from '@/types/pos.types'
import type { CustomerWithSegment, PromoValidateResult } from '@/types/crm.types'

// ─── Table status styling ─────────────────────────────────────────────────────

const STATUS_STYLES: Record<TableStatus, { bar: string; glow: string; text: string; dot: string; label: string }> = {
  AVAILABLE:      { bar: 'bg-emerald-500', glow: '',                                               text: 'text-white', dot: 'bg-emerald-400', label: 'Available'      },
  OCCUPIED:       { bar: 'bg-[#ff6b35]',   glow: 'shadow-[0_0_12px_2px_rgba(255,107,53,0.35)]',   text: 'text-white', dot: 'bg-[#ff6b35]',   label: 'Occupied'       },
  BILL_REQUESTED: { bar: 'bg-amber-400',   glow: 'shadow-[0_0_12px_2px_rgba(251,191,36,0.35)]',   text: 'text-white', dot: 'bg-amber-400',   label: 'Bill Requested' },
  RESERVED:       { bar: 'bg-blue-500',    glow: 'shadow-[0_0_10px_2px_rgba(59,130,246,0.3)]',    text: 'text-white', dot: 'bg-blue-400',    label: 'Reserved'       },
  CLEANING:       { bar: 'bg-violet-500',  glow: '',                                               text: 'text-white', dot: 'bg-violet-400',  label: 'Cleaning'       },
  OUT_OF_SERVICE: { bar: 'bg-gray-600',    glow: '',                                               text: 'text-gray-500', dot: 'bg-gray-600', label: 'Out of Service' },
} as Record<string, (typeof STATUS_STYLES)[TableStatus]>

const STATUS_LABEL: Record<TableStatus, string> = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning',
  OUT_OF_SERVICE: 'Out of Service',
}

// ─── ORDER STATUS ──────────────────────────────────────────────────────────────

const ORDER_STATUS_BADGE: Record<string, 'success' | 'warning' | 'info' | 'secondary' | 'destructive' | 'default'> = {
  PENDING:    'warning',
  ACCEPTED:   'info',
  PREPARING:  'warning',
  READY:      'success',
  SERVED:     'success',
  COMPLETED:  'secondary',
  CANCELLED:  'destructive',
  REFUNDED:   'secondary',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveSession(table: POSTableSummary) {
  return table.sessions?.find((s) => s.status === 'OPEN' || s.status === 'BILL_REQUESTED')
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((s, m) => s + m.price, 0)
    return sum + (item.unitPrice + modSum) * item.quantity
  }, 0)
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

// Seat Guests Dialog
function SeatGuestsDialog({
  table,
  onClose,
  onOpen,
  loading,
}: {
  table: POSTableSummary
  onClose: () => void
  onOpen: (guestCount: number, notes: string) => void
  loading: boolean
}) {
  const [guestCount, setGuestCount] = useState(1)
  const [notes, setNotes] = useState('')

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Seat Guests — Table {table.tableNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">Guests (capacity: {table.capacity})</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setGuestCount((c) => Math.max(1, c - 1))}
              >
                <Minus size={14} />
              </Button>
              <span className="text-2xl font-bold w-10 text-center">{guestCount}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setGuestCount((c) => Math.min(table.capacity, c + 1))}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              placeholder="e.g. Birthday, Allergy…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button onClick={() => onOpen(guestCount, notes)} loading={loading}>
            <Users size={14} />
            Seat Guests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Payment Dialog
function PaymentDialog({
  order,
  onClose,
  onPay,
  loading,
}: {
  order: SessionOrder
  onClose: () => void
  onPay: (method: string, amount: number) => void
  loading: boolean
}) {
  const total = Number(order.totalAmount)
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'MOBILE_BANKING'>('CASH')
  const [amountStr, setAmountStr] = useState(String(total))
  const amount = Number(amountStr) || 0
  const change = method === 'CASH' ? Math.max(0, amount - total) : 0

  const methods: { id: 'CASH' | 'CARD' | 'MOBILE_BANKING'; label: string }[] = [
    { id: 'CASH', label: 'Cash' },
    { id: 'CARD', label: 'Card' },
    { id: 'MOBILE_BANKING', label: 'Mobile' },
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Payment — {order.orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount due */}
          <div className="flex justify-between items-center rounded-lg bg-surface-subtle border border-border p-4">
            <span className="text-sm text-gray-600">Amount Due</span>
            <span className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>

          {/* Payment method */}
          <div>
            <Label className="mb-2 block">Payment Method</Label>
            <div className="flex gap-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMethod(m.id)
                    if (m.id !== 'CASH') setAmountStr(String(total))
                  }}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors',
                    method === m.id
                      ? 'border-brand bg-brand text-white'
                      : 'border-border bg-white text-gray-700 hover:bg-surface-subtle',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount tendered (cash only) */}
          {method === 'CASH' && (
            <div className="space-y-1.5">
              <Label>Amount Received</Label>
              <Input
                type="number"
                step="0.01"
                min={total}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
              {change > 0 && (
                <p className="text-sm text-emerald-700 font-medium">
                  Change due: {formatCurrency(change)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onPay(method, total)}
            loading={loading}
            disabled={method === 'CASH' && amount < total}
          >
            <CreditCard size={14} />
            Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Discount Dialog
function DiscountDialog({
  order,
  onClose,
  onApply,
  loading,
}: {
  order: SessionOrder
  onClose: () => void
  onApply: (type: 'FLAT' | 'PERCENT', value: number) => void
  loading: boolean
}) {
  const [type, setType] = useState<'FLAT' | 'PERCENT'>('PERCENT')
  const [value, setValue] = useState('')
  const subtotal = Number(order.subtotal)
  const preview = type === 'FLAT'
    ? Math.min(Number(value) || 0, subtotal)
    : subtotal * ((Number(value) || 0) / 100)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply Discount — {order.orderNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {(['PERCENT', 'FLAT'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  type === t
                    ? 'border-brand bg-brand text-white'
                    : 'border-border bg-white text-gray-700 hover:bg-surface-subtle',
                )}
              >
                {t === 'PERCENT' ? '% Percent' : '৳ Flat Amount'}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>{type === 'PERCENT' ? 'Discount (%)' : 'Discount Amount (৳)'}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={type === 'PERCENT' ? '100' : undefined}
              placeholder={type === 'PERCENT' ? '10' : '50'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {preview > 0 && (
              <p className="text-sm text-emerald-700">
                Discount: −{formatCurrency(preview)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onApply(type, Number(value))}
            loading={loading}
            disabled={!value || Number(value) <= 0}
          >
            <Tag size={14} />
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Transfer Table Dialog
function TransferTableDialog({
  sourceTable,
  availableTables,
  onClose,
  onTransfer,
  loading,
}: {
  sourceTable: POSTableSummary
  availableTables: POSTableSummary[]
  onClose: () => void
  onTransfer: (targetTableId: string) => void
  loading: boolean
}) {
  const [targetId, setTargetId] = useState<string | null>(null)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move Table {sourceTable.tableNumber}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-500">
            Select an available table to transfer the session and all orders to.
          </p>

          {availableTables.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              No available tables to transfer to.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {availableTables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTargetId(t.id)}
                  className={cn(
                    'rounded-lg border-2 p-3 text-left transition-all',
                    targetId === t.id
                      ? 'border-brand bg-brand/10'
                      : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
                  )}
                >
                  <p className={cn('font-bold text-base', targetId === t.id ? 'text-brand' : 'text-emerald-800')}>
                    {t.tableNumber}
                  </p>
                  <p className="text-xs text-gray-500">{t.capacity} seats</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => targetId && onTransfer(targetId)}
            loading={loading}
            disabled={!targetId}
          >
            <ArrowLeftRight size={14} />
            Move Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Floor Panel ───────────────────────────────────────────────────────────────

function TableCard({
  table,
  selected,
  onClick,
}: {
  table: POSTableSummary
  selected: boolean
  onClick: () => void
}) {
  const style = STATUS_STYLES[table.status] ?? STATUS_STYLES.OUT_OF_SERVICE
  const activeSession = getActiveSession(table)
  const orderTotal = activeSession?.orders?.reduce((s, o) => s + Number(o.totalAmount), 0) ?? 0
  const isOOS = table.status === 'OUT_OF_SERVICE'
  const orders = activeSession?.orders ?? []
  const totalOrders = orders.length
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length
  const hasQrOrders = orders.some((o) => o.channel === 'QR')

  return (
    <button
      onClick={onClick}
      disabled={isOOS}
      className={cn(
        'relative w-full text-left rounded-xl overflow-hidden transition-all duration-200',
        'bg-[#2a3040] border border-white/5',
        style.glow,
        selected && 'ring-2 ring-white/40 ring-offset-1 ring-offset-gray-100',
        isOOS && 'cursor-not-allowed opacity-40',
        !isOOS && 'hover:border-white/15 hover:scale-[1.02]',
      )}
    >
      {/* Colored left stripe */}
      <span className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', style.bar)} />

      <div className="pl-3 pr-2.5 py-2.5">
        <div className="flex items-start justify-between gap-1">
          <p className="font-bold text-base text-white leading-tight tracking-wide">
            {table.tableNumber}
          </p>
          <span className={cn(
            'w-2 h-2 rounded-full mt-1 flex-shrink-0',
            style.dot,
            (table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED') && 'animate-pulse',
          )} />
        </div>

        <p className="text-xs text-white/60 mt-0.5">{table.capacity} seats</p>

        {activeSession ? (
          <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/60">
                <span className="text-white font-medium">{activeSession.guestCount}</span> guests
              </p>
              {orderTotal > 0 && (
                <p className="text-xs font-bold text-white/80">
                  {formatCurrency(orderTotal)}
                </p>
              )}
            </div>

            {/* Order count + pending + QR badges */}
            {totalOrders > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-2xs bg-white/15 text-white/80 rounded px-1.5 py-0.5 font-medium">
                  {totalOrders} order{totalOrders !== 1 ? 's' : ''}
                </span>
                {pendingOrders > 0 && (
                  <span className="text-2xs bg-amber-400 text-white rounded px-1.5 py-0.5 font-bold animate-pulse">
                    {pendingOrders} pending
                  </span>
                )}
                {hasQrOrders && (
                  <span className="text-2xs bg-white/20 text-white/70 rounded px-1.5 py-0.5 font-medium">
                    QR
                  </span>
                )}
              </div>
            )}

            {activeSession.status === 'BILL_REQUESTED' && (
              <p className="text-2xs text-amber-400 font-medium">⚠ Bill Requested</p>
            )}
          </div>
        ) : (
          <p className="text-2xs text-white/50 mt-1.5">{style.label}</p>
        )}
      </div>
    </button>
  )
}

function FloorPanel({
  sections,
  summary,
  selectedTableId,
  onSelectTable,
  loading,
}: {
  sections: POSSection[]
  summary: POSOverview['summary'] | undefined
  selectedTableId: string | null
  onSelectTable: (table: POSTableSummary) => void
  loading: boolean
}) {
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const displaySections = useMemo(() => {
    if (activeSection) return sections.filter((s) => s.id === activeSection)
    return sections
  }, [sections, activeSection])

  return (
    <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-border bg-gray-50 overflow-hidden">
      {/* Stats bar */}
      <div className="px-4 py-3 border-b border-border bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900 text-sm">Floor Plan</h2>
          {loading && <RefreshCw size={12} className="animate-spin text-gray-400" />}
        </div>
        <div className="flex gap-3 text-2xs">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {summary?.available ?? 0} Available
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b35] inline-block" />
            {summary?.occupied ?? 0} Occupied
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
            {summary?.cleaning ?? 0} Cleaning
          </span>
        </div>
      </div>

      {/* Section filter tabs */}
      {sections.length > 1 && (
        <div className="flex gap-1 px-3 py-2 border-b border-border bg-white overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setActiveSection(null)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              activeSection === null
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            All
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeSection === s.id
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Table grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {sections.length === 0 && !loading && (
          <div className="py-12 text-center text-gray-500">
            <p className="text-sm">No tables configured</p>
            <p className="text-xs mt-1">Add floor sections and tables in Settings</p>
          </div>
        )}

        {displaySections.map((section) => (
          <div key={section.id} className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
              {section.name}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {section.tables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  selected={selectedTableId === table.id}
                  onClick={() => onSelectTable(table)}
                />
              ))}
            </div>
            {section.tables.length === 0 && (
              <p className="text-xs text-gray-400 italic px-1">No tables in this section</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Menu Browser ──────────────────────────────────────────────────────────────

import type { Category, MenuItem } from '@/types/menu.types'

function MenuBrowser({
  categories,
  items,
  onAddToCart,
}: {
  categories: Category[]
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
}) {
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!item.isAvailable) return false
      if (activeCat && item.categoryId !== activeCat) return false
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [items, activeCat, search])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto flex-shrink-0">
        <button
          onClick={() => setActiveCat(null)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
            activeCat === null
              ? 'bg-brand text-white border-brand'
              : 'bg-white text-gray-600 border-border hover:bg-surface-subtle',
          )}
        >
          All
        </button>
        {categories.filter((c) => c.isActive).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors',
              activeCat === cat.id
                ? 'bg-brand text-white border-brand'
                : 'bg-white text-gray-600 border-border hover:bg-surface-subtle',
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items grid (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No items found</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((item) => {
            const hasModifiers = (item.modifierGroups?.length ?? 0) > 0
            return (
              <button
                key={item.id}
                onClick={() => onAddToCart(item)}
                className="group relative flex flex-col text-left rounded-xl border border-border bg-white hover:border-brand/40 hover:shadow-md transition-all duration-150 overflow-hidden"
              >
                {/* Modifier badge */}
                {hasModifiers && (
                  <span className="absolute top-2 right-2 text-2xs bg-brand/10 text-brand font-medium px-1.5 py-0.5 rounded-full">
                    Options
                  </span>
                )}

                <div className="flex-1 p-3 pb-2">
                  <p className="text-sm font-semibold text-gray-900 leading-tight pr-12 line-clamp-2">
                    {item.name}
                  </p>
                </div>

                <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-gray-50">
                  <span className="text-sm font-bold text-brand">
                    {formatCurrency(Number(item.price))}
                  </span>
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand text-white group-hover:bg-brand/90 transition-colors flex-shrink-0">
                    <Plus size={13} />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Cart ──────────────────────────────────────────────────────────────────────

function CartView({
  cart,
  onQtyChange,
  onRemove,
  onClear,
  onPlaceOrder,
  placingOrder,
}: {
  cart: CartItem[]
  onQtyChange: (idx: number, delta: number) => void
  onRemove: (idx: number) => void
  onClear: () => void
  onPlaceOrder: () => void
  placingOrder: boolean
}) {
  const total = cartTotal(cart)

  return (
    <div className="border-t border-border bg-surface-subtle flex-shrink-0">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Cart ({cart.length})
        </span>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Clear
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-gray-400 italic">Add items from the menu above</p>
      ) : (
        <>
          <div className="px-4 space-y-1.5 max-h-36 overflow-y-auto">
            {cart.map((item, idx) => (
              <div key={`${item.itemId}-${idx}`} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onQtyChange(idx, -1)}
                    className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onQtyChange(idx, +1)}
                    className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                  >
                    <Plus size={10} />
                  </button>
                </div>
                <span className="flex-1 text-sm text-gray-800 truncate">{item.name}</span>
                <span className="text-sm font-medium text-gray-700">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
                <button
                  onClick={() => onRemove(idx)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 flex items-center justify-between border-t border-border mt-2">
            <div>
              <span className="text-xs text-gray-500">Subtotal</span>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(total)}</p>
            </div>
            <Button onClick={onPlaceOrder} loading={placingOrder} size="lg">
              Place Order
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Order Item display ───────────────────────────────────────────────────────

function OrderCard({
  order,
  onPay,
  onDiscount,
}: {
  order: SessionOrder
  onPay: (order: SessionOrder) => void
  onDiscount: (order: SessionOrder) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const activeItems = order.items.filter((i) => !i.isVoid)
  const alreadyPaid = (order.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0)
  const isPaid = order.status === 'COMPLETED' || order.status === 'REFUNDED' || alreadyPaid >= Number(order.totalAmount) - 0.01
  const isCancelled = order.status === 'CANCELLED'
  const isServedNotPaid = order.status === 'COMPLETED' && order.channel === 'QR'

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-surface-subtle"
        onClick={() => setExpanded((p) => !p)}
      >
        <ChevronRight
          size={14}
          className={cn('text-gray-400 transition-transform flex-shrink-0', expanded && 'rotate-90')}
        />
        <span className="font-mono text-sm font-semibold text-gray-700">{order.orderNumber}</span>
        <Badge variant={ORDER_STATUS_BADGE[order.status] ?? 'secondary'} className="text-2xs ml-1">
          {order.status}
        </Badge>
        {order.status === 'COMPLETED' && (() => {
          const paid = (order.payments ?? []).find((p: any) => p.status === 'COMPLETED')
          const label = paid?.paymentMethod === 'CASH' ? '💵 Cash'
            : paid?.paymentMethod === 'CARD' ? '💳 Card'
            : paid?.paymentMethod === 'MOBILE_BANKING' ? '📱 Mobile'
            : paid ? '✓ Paid'
            : '✓ Paid'
          return <span className="text-2xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">{label}</span>
        })()}
        <span className="ml-auto text-sm font-bold text-gray-900">
          {formatCurrency(Number(order.totalAmount))}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* Items */}
          <div className="px-3 py-2 space-y-1">
            {activeItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-800">
                  <span className="font-medium">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-gray-600 flex-shrink-0">
                  {formatCurrency(Number(item.totalPrice))}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-3 py-2 border-t border-border bg-surface-subtle text-xs space-y-0.5">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(order.subtotal))}</span>
            </div>
            {Number(order.taxAmount) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatCurrency(Number(order.taxAmount))}</span>
              </div>
            )}
            {Number(order.serviceCharge) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Service charge</span>
                <span>{formatCurrency(Number(order.serviceCharge))}</span>
              </div>
            )}
            {Number(order.discountAmount) > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount</span>
                <span>−{formatCurrency(Number(order.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-900 font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(Number(order.totalAmount))}</span>
            </div>
          </div>

          {/* Actions */}
          {!isPaid && !isCancelled && (
            <div className="px-3 py-2 border-t border-border flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onDiscount(order)}
              >
                <Tag size={12} />
                Discount
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onPay(order)}
              >
                <CreditCard size={12} />
                Pay {formatCurrency(Number(order.totalAmount))}
              </Button>
            </div>
          )}
          {isPaid && (
            <div className="px-3 py-2 border-t border-border">
              <Badge
                variant={isServedNotPaid ? 'secondary' : 'success'}
                className={cn('text-xs', isServedNotPaid && 'bg-blue-100 text-blue-700 hover:bg-blue-100')}
              >
                {isServedNotPaid ? 'Served' : 'Paid'}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── M21 Customer + Promo Panel ───────────────────────────────────────────────

function CustomerPromoPanel({
  restaurantId,
  posCustomer,
  promoResult,
  cartTotal,
  onCustomerSelect,
  onPromoApplied,
}: {
  restaurantId: string
  posCustomer: CustomerWithSegment | null
  promoResult: PromoValidateResult | null
  cartTotal: number
  onCustomerSelect: (c: CustomerWithSegment | null) => void
  onPromoApplied: (r: PromoValidateResult | null) => void
}) {
  const [customerSearch, setCustomerSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)

  const { data: customerResults } = useQuery({
    queryKey: ['crm', 'customers-search', restaurantId, customerSearch],
    queryFn: () => crmApi.listCustomers(restaurantId, { search: customerSearch, limit: 5 }),
    enabled: !!restaurantId && customerSearch.length >= 2,
  })

  async function handleValidatePromo() {
    if (!promoCode) return
    setPromoLoading(true)
    try {
      const res = await crmApi.validatePromo(restaurantId, {
        code: promoCode.toUpperCase(),
        orderAmount: cartTotal,
      })
      onPromoApplied(res)
    } catch {
      onPromoApplied(null)
    } finally {
      setPromoLoading(false)
    }
  }

  const TIER_COLORS: Record<string, string> = {
    BRONZE: 'text-amber-700',
    SILVER: 'text-gray-500',
    GOLD: 'text-yellow-500',
    PLATINUM: 'text-blue-500',
  }

  return (
    <div className="flex-shrink-0 bg-white border-b border-border px-3 py-2 space-y-2">
      {/* Customer search */}
      <div className="relative">
        {posCustomer ? (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 rounded-lg text-sm">
            <Users size={13} className="text-blue-500 flex-shrink-0" />
            <span className="font-medium text-gray-900 flex-1">
              {posCustomer.firstName} {posCustomer.lastName ?? ''}
              {posCustomer.loyaltyTier && (
                <span className={`ml-1 text-xs ${TIER_COLORS[posCustomer.loyaltyTier] ?? ''}`}>
                  · {posCustomer.loyaltyTier}
                </span>
              )}
            </span>
            <span className="text-xs text-gray-500">{posCustomer.loyaltyPoints} pts</span>
            <button
              onClick={() => onCustomerSelect(null)}
              className="text-gray-400 hover:text-red-500 ml-1"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search customer by name, phone or email…"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {showDropdown && customerSearch.length >= 2 && customerResults && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-border rounded-lg shadow-lg mt-1 max-h-36 overflow-y-auto">
                {customerResults.customers.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">No customers found</p>
                ) : (
                  customerResults.customers.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 hover:bg-surface-muted text-xs border-b border-border last:border-0"
                      onClick={() => {
                        onCustomerSelect(c)
                        setCustomerSearch('')
                        setShowDropdown(false)
                      }}
                    >
                      <span className="font-medium">{c.firstName} {c.lastName ?? ''}</span>
                      <span className="text-gray-400 ml-2">{c.phone ?? c.email ?? ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Promo code */}
      <div className="flex items-center gap-2">
        <Tag size={13} className="text-gray-400 flex-shrink-0" />
        {promoResult?.valid ? (
          <div className="flex items-center gap-2 flex-1 px-2 py-1 bg-green-50 rounded-lg text-xs text-green-700">
            <span className="font-medium">Promo applied: −{formatCurrency(promoResult.discountAmount ?? 0)}</span>
            <button onClick={() => { onPromoApplied(null); setPromoCode('') }} className="ml-auto text-green-600 hover:text-red-500">
              <X size={11} />
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Promo code…"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); onPromoApplied(null) }}
              className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand uppercase"
            />
            <button
              onClick={handleValidatePromo}
              disabled={promoLoading || !promoCode}
              className="px-2.5 py-1.5 text-xs bg-brand text-white rounded-lg disabled:opacity-50 hover:bg-brand/90 transition-colors"
            >
              {promoLoading ? '…' : 'Apply'}
            </button>
          </>
        )}
        {promoResult && !promoResult.valid && (
          <span className="text-xs text-red-600">{promoResult.reason}</span>
        )}
      </div>
    </div>
  )
}

// ─── Order Panel ───────────────────────────────────────────────────────────────

type RightTab = 'menu' | 'orders'

function OrderPanel({
  table,
  session,
  loadingSession,
  categories,
  items,
  cart,
  onCartAdd,
  onCartQty,
  onCartRemove,
  onCartClear,
  onPlaceOrder,
  placingOrder,
  onSeatGuests,
  onRequestBill,
  onCloseSession,
  onMarkAvailable,
  onPay,
  onDiscount,
  restaurantId,
  posCustomer,
  promoResult,
  onCustomerSelect,
  onPromoApplied,
  cartTotal: cartTotalAmount,
  onTransferTable,
  availableTables,
  transferring,
}: {
  table: POSTableSummary | null
  session: CurrentSession | null
  loadingSession: boolean
  categories: Category[]
  items: MenuItem[]
  cart: CartItem[]
  onCartAdd: (item: MenuItem) => void
  onCartQty: (idx: number, delta: number) => void
  onCartRemove: (idx: number) => void
  onCartClear: () => void
  onPlaceOrder: () => void
  placingOrder: boolean
  onSeatGuests: () => void
  onRequestBill: () => void
  onCloseSession: (force?: boolean) => void
  onMarkAvailable: () => void
  onPay: (order: SessionOrder) => void
  onDiscount: (order: SessionOrder) => void
  restaurantId: string
  posCustomer: CustomerWithSegment | null
  promoResult: PromoValidateResult | null
  onCustomerSelect: (c: CustomerWithSegment | null) => void
  onPromoApplied: (r: PromoValidateResult | null) => void
  cartTotal: number
  onTransferTable: (targetTableId: string) => void
  availableTables: POSTableSummary[]
  transferring: boolean
}) {
  const [tab, setTab] = useState<RightTab>('menu')
  const [forceCloseConfirm, setForceCloseConfirm] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const { user } = useAuthStore()

  // Auto-switch to Orders tab for QR sessions (customers order themselves)
  useEffect(() => {
    if (session?.orders.some((o) => o.channel === 'QR')) {
      setTab('orders')
    }
  }, [session])

  if (!table) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-surface-muted">
        <CircleDot size={40} className="mb-3 opacity-40" />
        <p className="text-base font-medium">Select a table to begin</p>
        <p className="text-sm mt-1">Click any available table on the floor plan</p>
      </div>
    )
  }

  if (table.status === 'CLEANING') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-violet-50 gap-4">
        <Brush size={40} className="text-violet-400" />
        <div className="text-center">
          <p className="font-semibold text-violet-800">Table {table.tableNumber} — Cleaning</p>
          <p className="text-sm text-violet-600 mt-1">Mark as available when ready</p>
        </div>
        <Button onClick={onMarkAvailable} variant="outline">
          Mark Available
        </Button>
      </div>
    )
  }

  if (table.status === 'RESERVED') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-blue-50 gap-4">
        <ReceiptText size={40} className="text-blue-400" />
        <p className="font-semibold text-blue-800">Table {table.tableNumber} — Reserved</p>
        <Button onClick={onSeatGuests}>Seat Guests</Button>
      </div>
    )
  }

  if (table.status === 'AVAILABLE') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-muted gap-4">
        <Users size={40} className="text-gray-300" />
        <div className="text-center">
          <p className="font-semibold text-gray-700">Table {table.tableNumber}</p>
          <p className="text-sm text-gray-500 mt-1">Table is available — seat guests to start</p>
        </div>
        <Button onClick={onSeatGuests}>
          <Users size={14} />
          Seat Guests
        </Button>
      </div>
    )
  }

  // OCCUPIED or BILL_REQUESTED
  const sessionStatus = session?.status ?? getActiveSession(table)?.status ?? 'OPEN'
  const allPaid = session
    ? session.orders.length === 0 ||
      session.orders.every((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED' || o.status === 'REFUNDED')
    : false
  const isQrSession = session?.orders.some((o) => o.channel === 'QR') ?? false
  const isManager = user?.role === 'MANAGER' || user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Session header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">Table {table.tableNumber}</span>
            {session && (
              <span className="text-gray-500 text-sm">· {session.guestCount} guests</span>
            )}
            <Badge
              variant={sessionStatus === 'BILL_REQUESTED' ? 'warning' : 'info'}
              className="text-2xs"
            >
              {sessionStatus === 'BILL_REQUESTED' ? 'Bill Requested' : 'Open Session'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {loadingSession && <RefreshCw size={12} className="animate-spin text-gray-400" />}

            {isManager && session && (
              <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)} loading={transferring}>
                <ArrowLeftRight size={13} />
                Move Table
              </Button>
            )}

            {sessionStatus === 'OPEN' && (
              <Button variant="outline" size="sm" onClick={onRequestBill}>
                <ReceiptText size={13} />
                Request Bill
              </Button>
            )}
            {allPaid && session && (
              <Button variant="outline" size="sm" onClick={() => onCloseSession(false)} className="text-red-600 border-red-200 hover:bg-red-50">
                Close Session
              </Button>
            )}
            {/* Force Close — managers only, shown when session can't be normally closed */}
            {!allPaid && session && isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForceCloseConfirm(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <X size={13} />
                Force Close
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Force close confirmation dialog */}
      {forceCloseConfirm && (
        <Dialog open onOpenChange={() => setForceCloseConfirm(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Force Close Table Session?</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-gray-600 space-y-2 py-2">
              <p>This will <strong>cancel all active orders</strong> at Table {table.tableNumber} and close the session immediately.</p>
              <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-xs">
                ⚠️ Any unpaid orders will be marked as Cancelled. Use this only when necessary (e.g. dine-and-dash, system error).
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => { setForceCloseConfirm(false); onCloseSession(true) }}
              >
                Force Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Transfer table dialog */}
      {transferDialogOpen && table && (
        <TransferTableDialog
          sourceTable={table}
          availableTables={availableTables.filter((t) => t.id !== table.id)}
          onClose={() => setTransferDialogOpen(false)}
          onTransfer={(targetTableId) => {
            onTransferTable(targetTableId)
            setTransferDialogOpen(false)
          }}
          loading={transferring}
        />
      )}

      {/* Tabs — show both tabs always so staff can switch back after adding items */}
      <div className="flex-shrink-0 flex border-b border-border bg-white">
        {(['menu', 'orders'] as RightTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            {t === 'menu' ? 'Menu & Cart' : `Orders (${session?.orders?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'menu' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-muted">
          {/* M21 — Customer + Promo panels */}
          <CustomerPromoPanel
            restaurantId={restaurantId}
            posCustomer={posCustomer}
            promoResult={promoResult}
            cartTotal={cartTotalAmount}
            onCustomerSelect={onCustomerSelect}
            onPromoApplied={onPromoApplied}
          />
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col pt-3">
            <MenuBrowser
              categories={categories}
              items={items}
              onAddToCart={onCartAdd}
            />
          </div>
          <CartView
            cart={cart}
            onQtyChange={onCartQty}
            onRemove={onCartRemove}
            onClear={onCartClear}
            onPlaceOrder={onPlaceOrder}
            placingOrder={placingOrder}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-muted">
          {loadingSession && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={16} className="animate-spin text-gray-400" />
            </div>
          )}

          {!loadingSession && (!session || session.orders.length === 0) && (
            <div className="py-12 text-center text-gray-400">
              <p className="text-sm">No orders yet</p>
              <p className="text-xs mt-1">Switch to Menu & Cart to place the first order</p>
            </div>
          )}

          {session?.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onPay={onPay}
              onDiscount={onDiscount}
            />
          ))}

          {session && session.orders.length > 0 && (
            <div className="border-t border-border pt-3 mt-2">
              <div className="flex justify-between text-sm font-semibold text-gray-900 px-1">
                <span>Session Total</span>
                <span>
                  {formatCurrency(
                    session.orders.reduce((s, o) => s + Number(o.totalAmount), 0),
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Staff override for QR sessions */}
          {isQrSession && (
            <button
              onClick={() => setTab('menu')}
              className="w-full mt-2 py-2.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors"
            >
              + Add items on behalf of customer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Quick Order Dialog ────────────────────────────────────────────────────────

type QuickOrderType = 'TAKEAWAY' | 'DINE_IN'

function QuickOrderDialog({
  restaurantId,
  categories,
  items,
  onClose,
  onPlaceOrder,
  placing,
}: {
  restaurantId: string
  categories: Category[]
  items: MenuItem[]
  onClose: () => void
  onPlaceOrder: (params: {
    channel: QuickOrderType
    cart: CartItem[]
    customerLabel: string
    customerId?: string
    discountAmount?: number
  }) => void
  placing: boolean
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<QuickOrderType>('TAKEAWAY')
  const [customerLabel, setCustomerLabel] = useState('')
  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null)
  const [posCustomer, setPosCustomer] = useState<CustomerWithSegment | null>(null)
  const [promoResult, setPromoResult] = useState<PromoValidateResult | null>(null)

  const total = cartTotal(cart)

  function addToCartDirectly(item: MenuItem, modifiers: CartModifier[] = []) {
    setCart((prev) => {
      if (modifiers.length === 0) {
        const idx = prev.findIndex((c) => c.itemId === item.id && c.modifiers.length === 0)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 }
          return updated
        }
      }
      return [...prev, { itemId: item.id, name: item.name, unitPrice: Number(item.price), quantity: 1, modifiers }]
    })
  }

  function handleAddToCart(item: MenuItem) {
    if ((item.modifierGroups?.length ?? 0) > 0) {
      setModifierModalItem(item)
    } else {
      addToCartDirectly(item)
    }
  }

  function handleCartQty(idx: number, delta: number) {
    setCart((prev) => {
      const updated = [...prev]
      const newQty = updated[idx].quantity + delta
      if (newQty <= 0) updated.splice(idx, 1)
      else updated[idx] = { ...updated[idx], quantity: newQty }
      return updated
    })
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Zap size={16} className="text-brand" />
              Quick Order
              <span className="text-sm font-normal text-gray-500">— No table required</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: Menu browser */}
            <div className="flex-1 flex flex-col min-h-0 border-r border-border pt-3">
              <MenuBrowser
                categories={categories}
                items={items}
                onAddToCart={handleAddToCart}
              />
            </div>

            {/* Right: cart + order details */}
            <div className="w-[300px] flex-shrink-0 flex flex-col min-h-0">
              {/* Customer / Promo */}
              <CustomerPromoPanel
                restaurantId={restaurantId}
                posCustomer={posCustomer}
                promoResult={promoResult}
                cartTotal={total}
                onCustomerSelect={setPosCustomer}
                onPromoApplied={setPromoResult}
              />

              {/* Cart items */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1.5">
                {cart.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-8">
                    Add items from the menu
                  </p>
                ) : (
                  cart.map((item, idx) => (
                    <div key={`${item.itemId}-${idx}`} className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCartQty(idx, -1)}
                          className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleCartQty(idx, +1)}
                          className="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <span className="flex-1 text-sm text-gray-800 truncate">{item.name}</span>
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                      <button
                        onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer: order type + customer label + totals + place */}
              <div className="flex-shrink-0 border-t border-border p-4 space-y-3 bg-surface-subtle">
                {/* Order type */}
                <div>
                  <Label className="text-xs mb-1.5 block">Order Type</Label>
                  <div className="flex gap-2">
                    {(['TAKEAWAY', 'DINE_IN'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={cn(
                          'flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors',
                          orderType === t
                            ? 'border-brand bg-brand text-white'
                            : 'border-border bg-white text-gray-700 hover:bg-gray-50',
                        )}
                      >
                        {t === 'TAKEAWAY' ? '🛍️ Takeaway' : '🪑 Dine-In'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer name / token */}
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name / Token (optional)</Label>
                  <Input
                    placeholder="e.g. John, Token #42…"
                    value={customerLabel}
                    onChange={(e) => setCustomerLabel(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* Totals */}
                {cart.length > 0 && (
                  <div className="text-sm space-y-0.5">
                    {promoResult?.valid && (promoResult.discountAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-emerald-700 text-xs">
                        <span>Discount</span>
                        <span>−{formatCurrency(promoResult.discountAmount ?? 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() =>
                    onPlaceOrder({
                      channel: orderType,
                      cart,
                      customerLabel,
                      customerId: posCustomer?.id,
                      discountAmount: promoResult?.discountAmount,
                    })
                  }
                  loading={placing}
                  disabled={cart.length === 0}
                >
                  <Zap size={14} />
                  Place {orderType === 'TAKEAWAY' ? 'Takeaway' : 'Walk-in'} Order
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {modifierModalItem && (
        <ModifierModal
          item={modifierModalItem}
          onClose={() => setModifierModalItem(null)}
          onConfirm={(modifiers) => {
            addToCartDirectly(modifierModalItem, modifiers)
            setModifierModalItem(null)
          }}
        />
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()

  const [selectedTable, setSelectedTable] = useState<POSTableSummary | null>(null)
  const [seatDialogOpen, setSeatDialogOpen] = useState(false)
  const [payDialog, setPayDialog] = useState<SessionOrder | null>(null)
  const [discountDialog, setDiscountDialog] = useState<SessionOrder | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [modifierModalItem, setModifierModalItem] = useState<MenuItem | null>(null)
  // M21 — CRM integration
  const [posCustomer, setPosCustomer] = useState<CustomerWithSegment | null>(null)
  const [promoResult, setPromoResult] = useState<PromoValidateResult | null>(null)
  // Quick Order (tableless)
  const [quickOrderOpen, setQuickOrderOpen] = useState(false)

  // ── Offline mode ─────────────────────────────────────────────────────────────
  const isOnline = useOnlineStatus()
  const [offlineCategories, setOfflineCategories] = useState<Category[]>([])
  const [offlineItems, setOfflineItems] = useState<MenuItem[]>([])
  const [offlineOverview, setOfflineOverview] = useState<POSOverview | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['pos', 'overview', restaurantId],
    queryFn: () => posApi.overview(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 30_000, // auto-refresh floor plan every 30s
  })

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['pos', 'session', restaurantId, selectedTable?.id],
    queryFn: () => posApi.getCurrentSession(restaurantId, selectedTable!.id),
    enabled: !!restaurantId && !!selectedTable && (selectedTable.status === 'OCCUPIED' || selectedTable.status === 'BILL_REQUESTED'),
    retry: false,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['menu', 'categories', restaurantId],
    queryFn: () => menuApi.listCategories(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['menu', 'items', restaurantId],
    queryFn: () => menuApi.listItems(restaurantId),
    enabled: !!restaurantId,
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const invalidateOverview = () => qc.invalidateQueries({ queryKey: ['pos', 'overview', restaurantId] })
  const invalidateSession = () =>
    qc.invalidateQueries({ queryKey: ['pos', 'session', restaurantId, selectedTable?.id] })

  // Offline: load cached data from IndexedDB on mount (fallback when network unavailable)
  useEffect(() => {
    if (!restaurantId) return
    posDb.menuSnapshot.get(restaurantId).then((snap) => {
      if (snap) { setOfflineCategories(snap.categories); setOfflineItems(snap.items) }
    }).catch(() => {})
    posDb.floorSnapshot.get(restaurantId).then((snap) => {
      if (snap) setOfflineOverview(snap.overview)
    }).catch(() => {})
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a ref to selectedTable so the socket handler always sees the current value
  const selectedTableRef = useRef(selectedTable)
  useEffect(() => { selectedTableRef.current = selectedTable }, [selectedTable])

  // Real-time: refresh floor plan + session when a new order arrives via socket
  useEffect(() => {
    if (!restaurantId) return
    const socket = getSocket()

    function onNewOrder(payload: { tableId?: string | null; restaurantId: string }) {
      if (payload.restaurantId !== restaurantId) return
      // Always refresh floor plan (table status AVAILABLE→OCCUPIED)
      qc.invalidateQueries({ queryKey: ['pos', 'overview', restaurantId] })
      // If the ordered table is currently selected, also refresh its session immediately
      if (payload.tableId && selectedTableRef.current?.id === payload.tableId) {
        qc.invalidateQueries({ queryKey: ['pos', 'session', restaurantId, payload.tableId] })
      }
    }

    socket.on('new_order', onNewOrder)
    return () => { socket.off('new_order', onNewOrder) }
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  // When overview refreshes, sync selectedTable data
  const refreshSelectedTable = useCallback(() => {
    if (!selectedTable || !overview) return
    const section = overview.sections.find((s) => s.tables.some((t) => t.id === selectedTable.id))
    const updated = section?.tables.find((t) => t.id === selectedTable.id)
    if (updated) setSelectedTable(updated)
  }, [selectedTable, overview])

  // Offline: persist menu to IndexedDB when fetched online
  useEffect(() => {
    if (!restaurantId || !categories.length || !items.length) return
    posDb.menuSnapshot.put({ restaurantId, categories, items, cachedAt: Date.now() }).catch(() => {})
  }, [restaurantId, categories, items]) // eslint-disable-line react-hooks/exhaustive-deps

  // Offline: persist floor overview to IndexedDB when fetched online
  useEffect(() => {
    if (!restaurantId || !overview) return
    posDb.floorSnapshot.put({ restaurantId, overview, cachedAt: Date.now() }).catch(() => {})
  }, [restaurantId, overview]) // eslint-disable-line react-hooks/exhaustive-deps

  // Offline: sync queued orders when connection is (re)established
  useEffect(() => {
    if (!isOnline || !restaurantId) return
    posDb.offlineOrders
      .where('restaurantId').equals(restaurantId)
      .and((o) => !o.synced)
      .count()
      .then((count) => { if (count > 0) syncOfflineOrders() })
      .catch(() => {})
  }, [isOnline, restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function syncOfflineOrders() {
    // Atomically grab pending orders and mark them as synced in one transaction.
    // This prevents duplicate sends if this function is called concurrently
    // (e.g. network flickers, effect fires twice).
    let toSync: Awaited<ReturnType<typeof posDb.offlineOrders.toArray>> = []
    await posDb.transaction('rw', posDb.offlineOrders, async () => {
      toSync = await posDb.offlineOrders
        .where('restaurantId').equals(restaurantId)
        .and((o) => !o.synced)
        .toArray()
      for (const entry of toSync) {
        await posDb.offlineOrders.update(entry.id, { synced: true })
      }
    }).catch(() => {})

    if (toSync.length === 0) return
    toast.info(`Syncing ${toSync.length} queued order(s)…`)
    let ok = 0
    for (const entry of toSync) {
      try {
        await posApi.createOrder(restaurantId, entry.payload)
        ok++
      } catch {
        // API failed — revert so it retries on next reconnect
        await posDb.offlineOrders.update(entry.id, { synced: false }).catch(() => {})
      }
    }
    if (ok > 0) {
      toast.success(`${ok} order(s) synced successfully`)
      invalidateOverview()
    }
  }

  // Effective display data — falls back to IndexedDB cache when queries return empty
  const displayCategories = categories.length > 0 ? categories : offlineCategories
  const displayItems = items.length > 0 ? items : offlineItems
  const displayOverview = overview ?? offlineOverview

  // ── Mutations ────────────────────────────────────────────────────────────────

  const openSessionMutation = useMutation({
    mutationFn: (dto: { guestCount: number; notes?: string }) =>
      posApi.openSession(restaurantId, selectedTable!.id, dto),
    onSuccess: () => {
      toast.success('Session opened')
      setSeatDialogOpen(false)
      invalidateOverview()
      setTimeout(() => {
        // After overview refreshes, update selectedTable status
        invalidateSession()
      }, 300)
    },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => {
      // Force table status to OCCUPIED optimistically
      if (selectedTable) {
        setSelectedTable({ ...selectedTable, status: 'OCCUPIED' })
      }
    },
  })

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!session || !selectedTable) throw new Error('No active session')
      const payload = {
        channel: 'DINE_IN',
        tableId: selectedTable.id,
        tableSessionId: session.id,
        items: cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.quantity,
          notes: c.notes,
          modifiers: c.modifiers.map((m) => ({ modifierId: m.modifierId })),
        })),
        customerId: posCustomer?.id,
        discountAmount: promoResult?.discountAmount,
      }
      if (!isOnline) {
        await posDb.offlineOrders.add({
          id: crypto.randomUUID(),
          restaurantId,
          payload,
          queuedAt: Date.now(),
          synced: false,
        })
        return null // signal: queued offline
      }
      return posApi.createOrder(restaurantId, payload)
    },
    onSuccess: async (order) => {
      if (!order) {
        // Queued offline — clean up cart without server roundtrip
        toast.success('Order queued — will sync when back online')
        setCart([])
        setPosCustomer(null)
        setPromoResult(null)
        return
      }
      toast.success('Order placed')
      if (promoResult?.valid && promoResult.promoCodeId) {
        await crmApi
          .recordPromoUsage(restaurantId, {
            code: promoResult.promoCodeId,
            orderId: order?.id,
            customerId: posCustomer?.id,
          })
          .catch(() => {})
      }
      setCart([])
      setPosCustomer(null)
      setPromoResult(null)
      invalidateSession()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const requestBillMutation = useMutation({
    mutationFn: () => posApi.requestBill(restaurantId, selectedTable!.id),
    onSuccess: () => {
      toast.success('Bill requested')
      invalidateOverview()
      invalidateSession()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const closeSessionMutation = useMutation({
    mutationFn: (force = false) =>
      posApi.closeSession(restaurantId, selectedTable!.id, session!.id, { force }),
    onSuccess: () => {
      toast.success('Session closed — table set to Cleaning')
      setSelectedTable(null)
      invalidateOverview()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const markAvailableMutation = useMutation({
    mutationFn: () =>
      posApi.updateTableStatus(restaurantId, selectedTable!.id, 'AVAILABLE'),
    onSuccess: () => {
      toast.success('Table marked available')
      setSelectedTable(null)
      invalidateOverview()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const paymentMutation = useMutation({
    mutationFn: ({ orderId, method, amount }: { orderId: string; method: string; amount: number }) =>
      posApi.processPayment(restaurantId, orderId, { method, amount }),
    onSuccess: (result) => {
      toast.success(result?.isFullyPaid ? 'Payment collected — order completed' : 'Payment recorded — partial payment')
      setPayDialog(null)
      invalidateSession()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const discountMutation = useMutation({
    mutationFn: ({
      orderId,
      type,
      value,
    }: {
      orderId: string
      type: 'FLAT' | 'PERCENT'
      value: number
    }) => posApi.applyDiscount(restaurantId, orderId, { type, value }),
    onSuccess: () => {
      toast.success('Discount applied')
      setDiscountDialog(null)
      invalidateSession()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const transferSessionMutation = useMutation({
    mutationFn: (targetTableId: string) =>
      posApi.transferSession(restaurantId, selectedTable!.id, targetTableId),
    onSuccess: () => {
      toast.success('Session transferred — table updated')
      setSelectedTable(null)
      invalidateOverview()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const quickOrderMutation = useMutation({
    mutationFn: async (params: {
      channel: QuickOrderType
      cart: CartItem[]
      customerLabel: string
      customerId?: string
      discountAmount?: number
    }) => {
      const payload = {
        channel: params.channel,
        items: params.cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.quantity,
          notes: c.notes,
          modifiers: c.modifiers.map((m) => ({ modifierId: m.modifierId })),
        })),
        notes: params.customerLabel || undefined,
        customerId: params.customerId,
        discountAmount: params.discountAmount,
      }
      if (!isOnline) {
        await posDb.offlineOrders.add({
          id: crypto.randomUUID(),
          restaurantId,
          payload,
          queuedAt: Date.now(),
          synced: false,
        })
        return null
      }
      return posApi.createOrder(restaurantId, payload)
    },
    onSuccess: (order) => {
      if (!order) {
        toast.success('Order queued — will sync when back online')
      } else {
        toast.success(`Order ${order.orderNumber} placed — ${order.channel ?? 'TAKEAWAY'}`)
      }
      setQuickOrderOpen(false)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  // ── Cart handlers ─────────────────────────────────────────────────────────────

  function addToCartDirectly(item: MenuItem, modifiers: CartModifier[] = []) {
    setCart((prev) => {
      // Only merge with existing line if same item AND no modifiers (simple add)
      if (modifiers.length === 0) {
        const idx = prev.findIndex((c) => c.itemId === item.id && c.modifiers.length === 0)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 }
          return updated
        }
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitPrice: Number(item.price),
          quantity: 1,
          modifiers,
        },
      ]
    })
  }

  function handleAddToCart(item: MenuItem) {
    if ((item.modifierGroups?.length ?? 0) > 0) {
      setModifierModalItem(item)
    } else {
      addToCartDirectly(item)
    }
  }

  function handleCartQty(idx: number, delta: number) {
    setCart((prev) => {
      const updated = [...prev]
      const newQty = updated[idx].quantity + delta
      if (newQty <= 0) {
        updated.splice(idx, 1)
      } else {
        updated[idx] = { ...updated[idx], quantity: newQty }
      }
      return updated
    })
  }

  // ── Table selection ──────────────────────────────────────────────────────────

  function handleSelectTable(table: POSTableSummary) {
    setSelectedTable(table)
    setCart([])
    if (table.status === 'AVAILABLE' || table.status === 'RESERVED') {
      setSeatDialogOpen(true)
    }
  }

  const availableTables = useMemo<POSTableSummary[]>(() => {
    if (!overview) return []
    return overview.sections.flatMap((s) => s.tables.filter((t) => t.status === 'AVAILABLE'))
  }, [overview])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No restaurant linked to your account.
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* POS top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-brand flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">POS Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setQuickOrderOpen(true)}
            className="gap-1.5"
          >
            <Zap size={13} />
            Quick Order
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { invalidateOverview(); refreshSelectedTable() }}
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-500 text-white text-sm py-1.5 flex-shrink-0">
          <WifiOff size={14} />
          Working offline — orders will sync when reconnected
        </div>
      )}

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        <FloorPanel
          sections={displayOverview?.sections ?? []}
          summary={displayOverview?.summary}
          selectedTableId={selectedTable?.id ?? null}
          onSelectTable={handleSelectTable}
          loading={loadingOverview}
        />

        <OrderPanel
          table={selectedTable}
          session={session ?? null}
          loadingSession={loadingSession}
          categories={displayCategories}
          items={displayItems}
          cart={cart}
          onCartAdd={handleAddToCart}
          onCartQty={handleCartQty}
          onCartRemove={(idx) => setCart((p) => p.filter((_, i) => i !== idx))}
          onCartClear={() => setCart([])}
          onPlaceOrder={() => placeOrderMutation.mutate()}
          placingOrder={placeOrderMutation.isPending}
          onSeatGuests={() => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            setSeatDialogOpen(true)
          }}
          onRequestBill={() => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            requestBillMutation.mutate()
          }}
          onCloseSession={(force) => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            closeSessionMutation.mutate(force)
          }}
          onMarkAvailable={() => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            markAvailableMutation.mutate()
          }}
          onPay={setPayDialog}
          onDiscount={setDiscountDialog}
          restaurantId={restaurantId}
          posCustomer={posCustomer}
          promoResult={promoResult}
          onCustomerSelect={setPosCustomer}
          onPromoApplied={setPromoResult}
          cartTotal={cartTotal(cart)}
          onTransferTable={(targetTableId) => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            transferSessionMutation.mutate(targetTableId)
          }}
          availableTables={availableTables}
          transferring={transferSessionMutation.isPending}
        />
      </div>

      {/* Dialogs */}
      {seatDialogOpen && selectedTable && (
        <SeatGuestsDialog
          table={selectedTable}
          onClose={() => setSeatDialogOpen(false)}
          onOpen={(guestCount, notes) =>
            openSessionMutation.mutate({ guestCount, notes: notes || undefined })
          }
          loading={openSessionMutation.isPending}
        />
      )}

      {payDialog && (
        <PaymentDialog
          order={payDialog}
          onClose={() => setPayDialog(null)}
          onPay={(method, amount) => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            paymentMutation.mutate({ orderId: payDialog.id, method, amount })
          }}
          loading={paymentMutation.isPending}
        />
      )}

      {discountDialog && (
        <DiscountDialog
          order={discountDialog}
          onClose={() => setDiscountDialog(null)}
          onApply={(type, value) => {
            if (!isOnline) { toast.error('Requires internet connection'); return }
            discountMutation.mutate({ orderId: discountDialog.id, type, value })
          }}
          loading={discountMutation.isPending}
        />
      )}

      {modifierModalItem && (
        <ModifierModal
          item={modifierModalItem}
          onClose={() => setModifierModalItem(null)}
          onConfirm={(modifiers) => {
            addToCartDirectly(modifierModalItem, modifiers)
            setModifierModalItem(null)
          }}
        />
      )}

      {quickOrderOpen && (
        <QuickOrderDialog
          restaurantId={restaurantId}
          categories={displayCategories}
          items={displayItems}
          onClose={() => setQuickOrderOpen(false)}
          onPlaceOrder={(params) => quickOrderMutation.mutate(params)}
          placing={quickOrderMutation.isPending}
        />
      )}
    </div>
  )
}
