import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChefHat,
  Clock,
  RefreshCw,
  CheckCheck,
  Play,
  Bell,
  History,
  Layers,
  Check,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { kdsApi } from '@/lib/kds.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import type { KDSQueueEntry, KDSHistoryEntry, KitchenStatus, KDSStats } from '@/types/kds.types'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  KitchenStatus,
  { label: string; dot: string; cardBorder: string; cardBg: string; badge: string }
> = {
  QUEUED: {
    label: 'Queued',
    dot: 'bg-gray-400',
    cardBorder: 'border-gray-600',
    cardBg: 'bg-gray-800/60',
    badge: 'bg-gray-700 text-gray-200',
  },
  ACKNOWLEDGED: {
    label: 'Acknowledged',
    dot: 'bg-yellow-400',
    cardBorder: 'border-yellow-600',
    cardBg: 'bg-yellow-950/60',
    badge: 'bg-yellow-900 text-yellow-200',
  },
  PREPARING: {
    label: 'Preparing',
    dot: 'bg-orange-400',
    cardBorder: 'border-orange-500',
    cardBg: 'bg-orange-950/60',
    badge: 'bg-orange-900 text-orange-200',
  },
  READY: {
    label: 'Ready',
    dot: 'bg-green-400',
    cardBorder: 'border-green-500',
    cardBg: 'bg-green-950/60',
    badge: 'bg-green-900 text-green-200',
  },
  SERVED: {
    label: 'Served',
    dot: 'bg-blue-400',
    cardBorder: 'border-blue-600',
    cardBg: 'bg-blue-950/60',
    badge: 'bg-blue-900 text-blue-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-red-400',
    cardBorder: 'border-red-700',
    cardBg: 'bg-red-950/60',
    badge: 'bg-red-900 text-red-200',
  },
}

const CHANNEL_LABELS: Record<string, string> = {
  DINE_IN: 'Dine-in',
  TAKEAWAY: 'Takeaway',
  DELIVERY: 'Delivery',
  QR: 'QR',
  ONLINE: 'Online',
  KIOSK: 'Kiosk',
  AGGREGATOR: 'Aggregator',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function elapsedColor(seconds: number): string {
  if (seconds < 300) return 'text-green-400'
  if (seconds < 600) return 'text-yellow-400'
  return 'text-red-400'
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
  stats,
  isFetching,
  view,
  onViewChange,
  queueCount,
}: {
  stats: KDSStats | undefined
  isFetching: boolean
  view: 'queue' | 'history'
  onViewChange: (v: 'queue' | 'history') => void
  queueCount: number
}) {
  const active = stats?.activeItems

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white">
          <ChefHat size={16} />
        </div>
        <span className="text-white font-semibold text-sm">Kitchen Display</span>
        {isFetching && <RefreshCw size={12} className="animate-spin text-gray-500 ml-1" />}
      </div>

      {/* Active item counts */}
      <div className="flex items-center gap-4 text-xs">
        {[
          { label: 'Queued', count: active?.queued ?? 0, dot: 'bg-gray-400' },
          { label: 'Ack', count: active?.acknowledged ?? 0, dot: 'bg-yellow-400' },
          { label: 'Preparing', count: active?.preparing ?? 0, dot: 'bg-orange-400' },
          { label: 'Ready', count: active?.ready ?? 0, dot: 'bg-green-400' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-gray-300">
            <span className={cn('w-2 h-2 rounded-full', s.dot)} />
            <span className="font-semibold text-white">{s.count}</span>
            <span>{s.label}</span>
          </div>
        ))}
        {stats && (
          <div className="text-gray-500 border-l border-gray-700 pl-4">
            Today: <span className="text-gray-300 font-medium">{stats.today.totalOrders}</span> orders
            {stats.today.avgPrepMinutes != null && (
              <> · avg <span className="text-gray-300 font-medium">{stats.today.avgPrepMinutes}m</span></>
            )}
          </div>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => onViewChange('queue')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            view === 'queue'
              ? 'bg-brand text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <Layers size={12} />
          Queue
          {queueCount > 0 && (
            <span className="bg-white/20 text-white text-2xs px-1.5 py-0.5 rounded-full leading-none">
              {queueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onViewChange('history')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            view === 'history'
              ? 'bg-brand text-white'
              : 'text-gray-400 hover:text-white',
          )}
        >
          <History size={12} />
          History
        </button>
      </div>
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({
  entry,
  now,
  onAcknowledge,
  onStart,
  onBumpReady,
  onBumpServed,
  onMarkItemReady,
  loadingAction,
}: {
  entry: KDSQueueEntry
  now: number
  onAcknowledge: () => void
  onStart: () => void
  onBumpReady: () => void
  onBumpServed: () => void
  onMarkItemReady: (itemId: string) => void
  loadingAction: string | null
}) {
  const status = entry.overallKitchenStatus
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED
  const elapsedSecs = Math.floor((now - new Date(entry.createdAt).getTime()) / 1000)

  const activeItems = entry.items.filter((i) => !i.isVoid)

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border-2 overflow-hidden',
        cfg.cardBorder,
        cfg.cardBg,
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-base">{entry.orderNumber}</span>
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-medium">
              {CHANNEL_LABELS[entry.channel] ?? entry.channel}
            </span>
            {entry.tableNumber && (
              <span className="text-2xs px-1.5 py-0.5 rounded bg-white/10 text-gray-200 font-medium">
                T{entry.tableNumber}
              </span>
            )}
          </div>
          {entry.notes && (
            <p className="text-xs text-yellow-300 mt-0.5 italic">{entry.notes}</p>
          )}
        </div>

        {/* Elapsed time */}
        <div className="flex items-center gap-1">
          <Clock size={11} className={elapsedColor(elapsedSecs)} />
          <span className={cn('text-sm font-mono font-bold', elapsedColor(elapsedSecs))}>
            {formatElapsed(elapsedSecs)}
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div className="px-3 pb-2">
        <span
          className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', cfg.badge)}
        >
          {cfg.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-3 pb-2 flex-1 space-y-1.5">
        {activeItems.map((item) => {
          const itemCfg = STATUS_CONFIG[item.kitchenStatus] ?? STATUS_CONFIG.QUEUED
          const canMarkReady =
            item.kitchenStatus === 'PREPARING' || item.kitchenStatus === 'ACKNOWLEDGED'
          const isLoadingThis = loadingAction === `item-${item.id}`

          return (
            <div key={item.id} className="flex items-start gap-2">
              {/* Status dot */}
              <span
                className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', itemCfg.dot)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <span className="text-white text-sm font-medium">
                      {item.quantity}× {item.name}
                    </span>
                    {item.modifiers.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        +{item.modifiers.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-yellow-400 italic mt-0.5">{item.notes}</p>
                    )}
                  </div>
                  {/* Per-item ready button */}
                  {canMarkReady && (
                    <button
                      onClick={() => onMarkItemReady(item.id)}
                      disabled={!!loadingAction}
                      title="Mark item ready"
                      className={cn(
                        'flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                        'bg-green-900/60 text-green-400 hover:bg-green-800 disabled:opacity-40',
                        isLoadingThis && 'animate-pulse',
                      )}
                    >
                      <Check size={12} />
                    </button>
                  )}
                  {item.kitchenStatus === 'READY' && (
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                      <Check size={12} className="text-green-400" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Action footer */}
      <div className="px-3 pb-3 pt-2 border-t border-white/10 mt-1">
        {status === 'QUEUED' && (
          <Button
            size="sm"
            className="w-full bg-yellow-700 hover:bg-yellow-600 text-white border-0 text-xs"
            onClick={onAcknowledge}
            loading={loadingAction === 'acknowledge'}
            disabled={!!loadingAction}
          >
            <Bell size={12} />
            Acknowledge
          </Button>
        )}
        {status === 'ACKNOWLEDGED' && (
          <Button
            size="sm"
            className="w-full bg-brand hover:bg-brand/90 text-white border-0 text-xs"
            onClick={onStart}
            loading={loadingAction === 'start'}
            disabled={!!loadingAction}
          >
            <Play size={12} />
            Start Cooking
          </Button>
        )}
        {status === 'PREPARING' && (
          <Button
            size="sm"
            className="w-full bg-green-700 hover:bg-green-600 text-white border-0 text-xs"
            onClick={onBumpReady}
            loading={loadingAction === 'bump-ready'}
            disabled={!!loadingAction}
          >
            <CheckCheck size={12} />
            All Ready
          </Button>
        )}
        {status === 'READY' && (
          <Button
            size="sm"
            className="w-full bg-blue-700 hover:bg-blue-600 text-white border-0 text-xs"
            onClick={onBumpServed}
            loading={loadingAction === 'bump-served'}
            disabled={!!loadingAction}
          >
            <CheckCheck size={12} />
            Bump Served
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── History view ─────────────────────────────────────────────────────────────

function HistoryView({ entries }: { entries: KDSHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <History size={40} className="mb-3 opacity-40" />
        <p className="text-sm">No completed orders yet</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {entries.map((entry) => {
        const prepMin =
          entry.prepSeconds != null ? Math.round(entry.prepSeconds / 60) : null

        return (
          <div
            key={entry.orderId}
            className="flex items-center justify-between rounded-lg bg-gray-800/50 border border-gray-700 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-sm">{entry.orderNumber}</span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full bg-white/10 text-gray-300">
                {CHANNEL_LABELS[entry.channel] ?? entry.channel}
              </span>
              {entry.tableNumber && (
                <span className="text-2xs text-gray-400">T{entry.tableNumber}</span>
              )}
              <span className="text-xs text-gray-500">
                {entry.items.filter((i) => i.kitchenStatus !== 'CANCELLED').length} items
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {prepMin != null && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {prepMin}m prep
                </span>
              )}
              <span className="text-green-400 font-semibold">
                {new Date(entry.readyAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ActionState = {
  orderId: string
  action: string
} | null

export default function KDSPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()

  const [view, setView] = useState<'queue' | 'history'>('queue')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [now, setNow] = useState(() => Date.now())
  const [activeAction, setActiveAction] = useState<ActionState>(null)

  // Live clock for elapsed timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: queue = [], isFetching: queueFetching } = useQuery({
    queryKey: ['kds', 'queue', restaurantId, statusFilter],
    queryFn: () =>
      kdsApi.queue(restaurantId, statusFilter ? { status: statusFilter } : undefined),
    enabled: !!restaurantId && view === 'queue',
    refetchInterval: 5_000,
  })

  const { data: history = [], isFetching: historyFetching } = useQuery({
    queryKey: ['kds', 'history', restaurantId],
    queryFn: () => kdsApi.history(restaurantId, { limit: 30 }),
    enabled: !!restaurantId && view === 'history',
    refetchInterval: 15_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['kds', 'stats', restaurantId],
    queryFn: () => kdsApi.stats(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 10_000,
  })

  const invalidateQueue = useCallback(
    () => qc.invalidateQueries({ queryKey: ['kds', 'queue', restaurantId] }),
    [qc, restaurantId],
  )

  // ── Mutations ────────────────────────────────────────────────────────────────
  const acknowledgeMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.acknowledge(restaurantId, orderId),
    onSuccess: (res) => {
      toast.success(`Acknowledged ${res.acknowledged} item${res.acknowledged !== 1 ? 's' : ''}`)
      invalidateQueue()
    },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setActiveAction(null),
  })

  const startMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.start(restaurantId, orderId),
    onSuccess: (res) => {
      toast.success(`Started ${res.started} item${res.started !== 1 ? 's' : ''}`)
      invalidateQueue()
    },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setActiveAction(null),
  })

  const bumpReadyMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.bumpReady(restaurantId, orderId),
    onSuccess: (res) => {
      toast.success(`${res.orderNumber} — all items ready!`)
      invalidateQueue()
    },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setActiveAction(null),
  })

  const bumpServedMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.bumpServed(restaurantId, orderId),
    onSuccess: (res) => {
      toast.success(`${res.orderNumber} — bumped to served`)
      invalidateQueue()
    },
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setActiveAction(null),
  })

  const markItemReadyMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      kdsApi.markItemReady(restaurantId, orderId, itemId),
    onSuccess: () => invalidateQueue(),
    onError: (err) => toast.error(apiError(err)),
    onSettled: () => setActiveAction(null),
  })

  // ── Action handlers ──────────────────────────────────────────────────────────
  function handleAcknowledge(orderId: string) {
    setActiveAction({ orderId, action: 'acknowledge' })
    acknowledgeMutation.mutate(orderId)
  }
  function handleStart(orderId: string) {
    setActiveAction({ orderId, action: 'start' })
    startMutation.mutate(orderId)
  }
  function handleBumpReady(orderId: string) {
    setActiveAction({ orderId, action: 'bump-ready' })
    bumpReadyMutation.mutate(orderId)
  }
  function handleBumpServed(orderId: string) {
    setActiveAction({ orderId, action: 'bump-served' })
    bumpServedMutation.mutate(orderId)
  }
  function handleMarkItemReady(orderId: string, itemId: string) {
    setActiveAction({ orderId, action: `item-${itemId}` })
    markItemReadyMutation.mutate({ orderId, itemId })
  }

  const isFetching = queueFetching || historyFetching

  const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'QUEUED', label: 'Queued' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
    { value: 'PREPARING', label: 'Preparing' },
    { value: 'READY', label: 'Ready' },
  ]

  return (
    <div
      className="flex flex-col bg-gray-950"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {/* Top bar */}
      <StatsBar
        stats={stats}
        isFetching={isFetching}
        view={view}
        onViewChange={setView}
        queueCount={queue.length}
      />

      {/* Status filter (queue only) */}
      {view === 'queue' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <span className="text-xs text-gray-500 mr-1">Filter:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-brand text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {!restaurantId && (
          <div className="flex items-center justify-center h-full text-gray-500">
            No restaurant linked to your account.
          </div>
        )}

        {/* Queue view */}
        {restaurantId && view === 'queue' && (
          <>
            {queue.length === 0 && !queueFetching && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <ChefHat size={48} className="mb-4 opacity-30" />
                <p className="text-base font-medium text-gray-400">All clear</p>
                <p className="text-sm mt-1">No active orders in the queue</p>
              </div>
            )}

            {queue.length > 0 && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {queue.map((entry) => {
                  const isThisActive =
                    activeAction?.orderId === entry.orderId
                  return (
                    <OrderCard
                      key={entry.orderId}
                      entry={entry}
                      now={now}
                      onAcknowledge={() => handleAcknowledge(entry.orderId)}
                      onStart={() => handleStart(entry.orderId)}
                      onBumpReady={() => handleBumpReady(entry.orderId)}
                      onBumpServed={() => handleBumpServed(entry.orderId)}
                      onMarkItemReady={(itemId) =>
                        handleMarkItemReady(entry.orderId, itemId)
                      }
                      loadingAction={
                        isThisActive ? activeAction!.action : null
                      }
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* History view */}
        {restaurantId && view === 'history' && (
          <HistoryView entries={history} />
        )}
      </div>
    </div>
  )
}
