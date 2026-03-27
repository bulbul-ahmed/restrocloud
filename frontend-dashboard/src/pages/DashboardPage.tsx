import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ChefHat,
  Monitor,
  BarChart3,
  Settings,
  TableProperties,
  ArrowRight,
  Flame,
  Circle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageShell } from '@/components/layout/PageShell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth.store'
import { analyticsApi } from '@/lib/analytics.api'
import { posApi } from '@/lib/pos.api'
import { kdsApi } from '@/lib/kds.api'
import { ordersApi } from '@/lib/orders.api'
import { settingsApi } from '@/lib/settings.api'
import { menuApi } from '@/lib/menu.api'
import { tablesApi } from '@/lib/tables.api'
import { getSocket } from '@/lib/socket'
import { formatCurrency } from '@/lib/utils'
import type { Order, OrderListResponse } from '@/types/order.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function pct(change: number | null) {
  if (change === null) return null
  return { up: change >= 0, label: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` }
}

const CHANNEL_COLORS: Record<string, string> = {
  POS:        'bg-brand',
  QR:         'bg-violet-500',
  ONLINE:     'bg-blue-500',
  AGGREGATOR: 'bg-amber-500',
  TAKEAWAY:   'bg-emerald-500',
  DELIVERY:   'bg-rose-500',
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  ACCEPTED:  'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY:     'bg-green-100 text-green-800',
  SERVED:    'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ─── Getting Started Checklist ────────────────────────────────────────────────

const STEP_META: { label: string; desc: string; to: string | null; optional?: true }[] = [
  { label: 'Create restaurant account',     desc: 'Your account and restaurant are live.',                            to: null },
  { label: 'Complete restaurant profile',   desc: 'Add your address, timezone, and contact info.',                   to: '/settings' },
  { label: 'Add first menu category',       desc: 'Organise your items — e.g. Starters, Mains, Drinks.',            to: '/menu/categories' },
  { label: 'Add first menu item',           desc: 'Customers can\'t order without at least one item on the menu.',   to: '/menu/items' },
  { label: 'Set up a floor section & table', desc: 'Required for dine-in POS and QR table ordering.',               to: '/tables' },
  { label: 'Invite a staff member',         desc: 'Add a cashier or manager to help run the restaurant.',            to: '/staff', optional: true },
]

function GettingStartedChecklist({ restaurantId }: { restaurantId: string }) {
  const dismissed = restaurantId ? localStorage.getItem(`checklist_dismissed_${restaurantId}`) === '1' : true
  const [localDismissed, setLocalDismissed] = useState(dismissed)

  const { data: settings }   = useQuery({ queryKey: ['settings', restaurantId],             queryFn: () => settingsApi.get(restaurantId),           enabled: !!restaurantId, staleTime: Infinity })
  const { data: categories } = useQuery({ queryKey: ['menu', 'categories', restaurantId],   queryFn: () => menuApi.listCategories(restaurantId),    enabled: !!restaurantId, staleTime: 5 * 60 * 1000 })
  const { data: items }      = useQuery({ queryKey: ['menu', 'items', restaurantId],        queryFn: () => menuApi.listItems(restaurantId),         enabled: !!restaurantId, staleTime: 5 * 60 * 1000 })
  const { data: sections }   = useQuery({ queryKey: ['floor-sections', restaurantId],       queryFn: () => tablesApi.listSections(restaurantId),    enabled: !!restaurantId, staleTime: 5 * 60 * 1000 })

  const done = [
    true,
    !!(settings?.address),
    (categories?.length ?? 0) > 0,
    (items?.length ?? 0) > 0,
    (sections?.length ?? 0) > 0,
    false,
  ]

  const completed  = done.filter(Boolean).length
  const allDone    = STEP_META.every(({ optional }, i) => optional || done[i])
  const activeIdx  = done.findIndex((d, i) => !d && !STEP_META[i].optional) !== -1
    ? done.findIndex((d, i) => !d && !STEP_META[i].optional)
    : done.findIndex((d) => !d)
  const pct        = Math.round((completed / done.length) * 100)

  function dismiss() {
    if (restaurantId) localStorage.setItem(`checklist_dismissed_${restaurantId}`, '1')
    setLocalDismissed(true)
  }

  if (!restaurantId || localDismissed || allDone) return null

  return (
    <div className="mb-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Get your restaurant ready</p>
            <p className="text-xs text-gray-400 mt-0.5">{completed} of {done.length} steps complete</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-brand tabular-nums">{pct}%</span>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="text-gray-300 hover:text-gray-500 transition-colors"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="px-6 py-5">
          {STEP_META.map(({ label, desc, to, optional }, i) => {
            const isDone    = done[i]
            const isActive  = i === activeIdx
            const isFuture  = !isDone && !isActive

            return (
              <div key={label} className="flex gap-4">
                {/* Left: dot + line */}
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div className={`
                    relative w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10
                    ${isDone   ? 'bg-emerald-500'                        : ''}
                    ${isActive ? 'bg-brand shadow-md shadow-brand/30'    : ''}
                    ${isFuture ? 'bg-white border-2 border-gray-200'     : ''}
                  `}>
                    {isDone && (
                      <svg viewBox="0 0 10 8" fill="none" className="w-3.5 h-3.5">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {isActive && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-brand animate-ping opacity-25" />
                        <span className="w-2 h-2 rounded-full bg-white" />
                      </>
                    )}
                    {isFuture && (
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  {/* Connector line */}
                  {i < STEP_META.length - 1 && (
                    <div className={`w-px flex-1 my-1 ${isDone ? 'bg-emerald-200' : 'bg-gray-100'}`} />
                  )}
                </div>

                {/* Right: content */}
                <div className={`pb-5 flex-1 min-w-0 ${i === STEP_META.length - 1 ? 'pb-1' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mt-1">
                    <div>
                      <p className={`text-sm font-medium leading-snug ${
                        isDone   ? 'text-gray-400 line-through decoration-gray-300' :
                        isActive ? 'text-gray-900' :
                                   'text-gray-400'
                      }`}>
                        {label}
                        {optional && <span className="ml-1.5 text-xs font-normal text-gray-300 no-underline">(optional)</span>}
                      </p>
                      {!isDone && (
                        <p className={`text-xs mt-0.5 leading-relaxed ${isActive ? 'text-gray-500' : 'text-gray-300'}`}>
                          {desc}
                        </p>
                      )}
                    </div>
                    {isActive && to && (
                      <Link
                        to={to}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand/90 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Start <ArrowRight size={12} />
                      </Link>
                    )}
                    {isDone && (
                      <span className="shrink-0 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Done
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore()
  const rid = user?.restaurantId ?? ''

  const today = new Date().toISOString().split('T')[0]

  const queryClient = useQueryClient()

  // Invalidate pending orders whenever a new_order WebSocket event fires
  useEffect(() => {
    const socket = getSocket()
    function onNewOrder() {
      queryClient.invalidateQueries({ queryKey: ['dashboard-pending', rid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', rid] })
    }
    socket.on('new_order', onNewOrder)
    return () => { socket.off('new_order', onNewOrder) }
  }, [rid, queryClient])

  const [kpiQ, channelQ, topItemsQ, overviewQ, kdsQ, ordersQ, pendingQ] = useQueries({
    queries: [
      {
        queryKey: ['dashboard-kpis', rid],
        queryFn: () => analyticsApi.dashboard(rid),
        enabled: !!rid,
        refetchInterval: 60_000,
      },
      {
        queryKey: ['dashboard-channels', rid, today],
        queryFn: () => analyticsApi.byChannel(rid, { dateFrom: today, dateTo: today }),
        enabled: !!rid,
        refetchInterval: 60_000,
      },
      {
        queryKey: ['dashboard-top-items', rid, today],
        queryFn: () => analyticsApi.topItems(rid, { dateFrom: today, dateTo: today, limit: 5 }),
        enabled: !!rid,
        refetchInterval: 120_000,
      },
      {
        queryKey: ['dashboard-overview', rid],
        queryFn: () => posApi.overview(rid),
        enabled: !!rid,
        refetchInterval: 30_000,
      },
      {
        queryKey: ['dashboard-kds', rid],
        queryFn: () => kdsApi.queue(rid),
        enabled: !!rid,
        refetchInterval: 30_000,
      },
      {
        queryKey: ['dashboard-recent-orders', rid],
        queryFn: (): Promise<OrderListResponse> => ordersApi.list(rid, { limit: 6, page: 1 }),
        enabled: !!rid,
        refetchInterval: 30_000,
      },
      {
        queryKey: ['dashboard-pending', rid],
        queryFn: (): Promise<OrderListResponse> => ordersApi.list(rid, { status: 'PENDING', limit: 20, page: 1 }),
        enabled: !!rid,
        refetchInterval: 15_000,
      },
    ],
  })

  const kpis = kpiQ.data
  const channels = channelQ.data ?? []
  const topItems = topItemsQ.data ?? []
  const overview = overviewQ.data
  const kdsQueue = kdsQ.data ?? []
  const recentOrders: Order[] = ordersQ.data?.orders ?? []
  const pendingOrders: Order[] = pendingQ.data?.orders ?? []

  async function handleAccept(orderId: string) {
    try {
      await ordersApi.accept(rid, orderId)
      queryClient.invalidateQueries({ queryKey: ['dashboard-pending', rid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent-orders', rid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', rid] })
      toast.success('Order accepted')
    } catch {
      toast.error('Failed to accept order')
    }
  }

  async function handleReject(orderId: string) {
    try {
      await ordersApi.reject(rid, orderId)
      queryClient.invalidateQueries({ queryKey: ['dashboard-pending', rid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent-orders', rid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', rid] })
      toast.success('Order rejected')
    } catch {
      toast.error('Failed to reject order')
    }
  }

  const tableSummary = overview?.summary
  const kdsStats = {
    pending:   kdsQueue.filter((q) => q.kitchenStatus === 'PENDING').length,
    preparing: kdsQueue.filter((q) => q.kitchenStatus === 'PREPARING').length,
    ready:     kdsQueue.filter((q) => q.kitchenStatus === 'READY').length,
  }

  const revenueChange = pct(kpis?.vsYesterday.revenueChange ?? null)
  const currency = user?.restaurantName ? 'BDT' : 'BDT' // fallback; real currency from settings

  return (
    <PageShell breadcrumbs={[{ label: 'Dashboard' }]}>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, {user?.firstName} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Here's what's happening at your restaurant today.</p>
      </div>

      {/* ── Getting Started Checklist ───────────────────────────────────────── */}
      <GettingStartedChecklist restaurantId={rid} />

      {/* ── Needs Action: Pending Orders ────────────────────────────────────── */}
      {(pendingOrders.length > 0 || pendingQ.isLoading) && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">
              Needs Action
              {pendingOrders.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingOrders.length}
                </span>
              )}
            </h2>
            <span className="text-xs text-gray-400">— pending orders waiting for your approval</span>
          </div>

          {pendingQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border-2 border-amber-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{order.orderNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.channel === 'ONLINE' ? 'bg-blue-100 text-blue-700'
                          : order.channel === 'QR' ? 'bg-violet-100 text-violet-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{order.channel}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(order.createdAt)}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 shrink-0">
                      {formatCurrency(Number(order.totalAmount), currency)}
                    </span>
                  </div>

                  {(order as any).items?.length > 0 && (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {(order as any).items.slice(0, 3).map((it: any) => `${it.quantity}× ${it.name}`).join(', ')}
                      {(order as any).items.length > 3 && ` +${(order as any).items.length - 3} more`}
                    </p>
                  )}

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleAccept(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                    >
                      <CheckCircle2 size={13} /> Accept
                    </button>
                    <button
                      onClick={() => handleReject(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-colors"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                    <Link
                      to={`/orders/${order.id}`}
                      className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-medium border border-gray-200 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Row 1: KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Orders Today"
          value={kpis ? String(kpis.today.orders) : '—'}
          icon={ClipboardList}
          color="text-blue-600"
          bg="bg-blue-50"
          loading={kpiQ.isLoading}
          sub={kpis ? `${kpis.today.pendingOrders} pending` : undefined}
        />
        <KpiCard
          label="Revenue Today"
          value={kpis ? formatCurrency(kpis.today.revenue, currency) : '—'}
          icon={DollarSign}
          color="text-emerald-600"
          bg="bg-emerald-50"
          loading={kpiQ.isLoading}
          change={revenueChange}
          sub={revenueChange ? `vs ৳${kpis!.vsYesterday.yesterdayRevenue.toLocaleString()} yesterday` : undefined}
        />
        <KpiCard
          label="Avg Ticket"
          value={kpis ? formatCurrency(kpis.today.avgOrderValue, currency) : '—'}
          icon={TrendingUp}
          color="text-violet-600"
          bg="bg-violet-50"
          loading={kpiQ.isLoading}
          sub={kpis ? `${kpis.today.completedOrders} completed` : undefined}
        />
        <KpiCard
          label="New Customers"
          value={kpis ? String(kpis.today.newCustomers) : '—'}
          icon={Users}
          color="text-amber-600"
          bg="bg-amber-50"
          loading={kpiQ.isLoading}
          sub={kpis ? `${kpis.today.activeTableSessions} active sessions` : undefined}
        />
      </div>

      {/* ── Row 2: Live Operations ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Table Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <TableProperties size={15} className="text-brand" />
                Table Status
              </CardTitle>
              <Link to="/pos" className="text-xs text-brand hover:underline flex items-center gap-1">
                Open POS <ArrowRight size={11} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {overviewQ.isLoading ? (
              <div className="h-16 flex items-center justify-center">
                <Skeleton className="h-4 w-32" />
              </div>
            ) : tableSummary ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Occupied',  value: tableSummary.occupied,  dot: 'bg-brand',         text: 'text-brand' },
                  { label: 'Available', value: tableSummary.available, dot: 'bg-emerald-500',    text: 'text-emerald-700' },
                  { label: 'Cleaning',  value: tableSummary.cleaning,  dot: 'bg-violet-500',     text: 'text-violet-700' },
                ].map(({ label, value, dot, text }) => (
                  <div key={label} className="flex flex-col items-center justify-center bg-gray-50 rounded-xl py-3 px-2 gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className={`text-2xl font-bold ${text}`}>{value}</span>
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No table data</p>
            )}
            {tableSummary && (
              <p className="text-xs text-gray-400 mt-2 text-center">{tableSummary.total} total tables</p>
            )}
          </CardContent>
        </Card>

        {/* Kitchen Queue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ChefHat size={15} className="text-brand" />
                Kitchen Queue
              </CardTitle>
              <Link to="/kds" className="text-xs text-brand hover:underline flex items-center gap-1">
                Open KDS <ArrowRight size={11} />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {kdsQ.isLoading ? (
              <div className="h-16 flex items-center justify-center">
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Pending',   value: kdsStats.pending,   dot: 'bg-yellow-400',  text: 'text-yellow-700' },
                  { label: 'Preparing', value: kdsStats.preparing, dot: 'bg-orange-500',  text: 'text-orange-700' },
                  { label: 'Ready',     value: kdsStats.ready,     dot: 'bg-green-500',   text: 'text-green-700' },
                ].map(({ label, value, dot, text }) => (
                  <div key={label} className="flex flex-col items-center justify-center bg-gray-50 rounded-xl py-3 px-2 gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className={`text-2xl font-bold ${text}`}>{value}</span>
                    <span className="text-xs text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {!kdsQ.isLoading && (
              <p className="text-xs text-gray-400 mt-2 text-center">{kdsQueue.length} orders in kitchen</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Top Items + Channels ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top Selling Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Flame size={15} className="text-brand" />
              Today's Top Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topItemsQ.isLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : topItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No orders yet today</p>
            ) : (
              <div className="space-y-2">
                {topItems.map((item, i) => {
                  const maxQty = topItems[0]?.totalQty ?? 1
                  const pctWidth = Math.round((item.totalQty / maxQty) * 100)
                  return (
                    <div key={item.itemId ?? i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                          <span className="text-xs text-gray-500 shrink-0 ml-2">{item.totalQty} sold</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: `${pctWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders by Channel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BarChart3 size={15} className="text-brand" />
              Orders by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelQ.isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : channels.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No orders yet today</p>
            ) : (
              <div className="space-y-3">
                {channels.map((ch) => {
                  const total = channels.reduce((s, c) => s + c.orders, 0)
                  const pctWidth = total > 0 ? Math.round((ch.orders / total) * 100) : 0
                  const barColor = CHANNEL_COLORS[ch.channel] ?? 'bg-gray-400'
                  return (
                    <div key={ch.channel} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${barColor}`} />
                          <span className="font-medium text-gray-700">{ch.channel}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{ch.orders} orders</span>
                          <span className="font-semibold text-gray-700">{formatCurrency(ch.revenue, currency)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pctWidth}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Recent Orders + Quick Actions ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Orders — takes 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <ClipboardList size={15} className="text-brand" />
                Recent Orders
              </CardTitle>
              <Link to="/orders" className="text-xs text-brand hover:underline flex items-center gap-1">
                View all <ArrowRight size={11} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {ordersQ.isLoading ? (
              <div className="px-6 py-3 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No orders today</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/orders/${order.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{order.orderNumber}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{order.channel}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(order.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(Number(order.totalAmount), currency)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {order.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions — takes 1/3 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { icon: Monitor,         label: 'POS Terminal',    desc: 'Take orders',          to: '/pos',       color: 'text-brand' },
              { icon: ChefHat,         label: 'Kitchen Display', desc: 'Manage kitchen',       to: '/kds',       color: 'text-orange-500' },
              { icon: ClipboardList,   label: 'Orders',          desc: 'View all orders',      to: '/orders',    color: 'text-blue-500' },
              { icon: TableProperties, label: 'Tables',          desc: 'Floor plan',           to: '/tables',    color: 'text-violet-500' },
              { icon: BarChart3,       label: 'Reports',         desc: 'Revenue & analytics',  to: '/reports',   color: 'text-emerald-500' },
              { icon: Settings,        label: 'Settings',        desc: 'Restaurant config',    to: '/settings',  color: 'text-gray-500' },
            ].map(({ icon: Icon, label, desc, to, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <ArrowRight size={13} className="text-gray-300 ml-auto group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, bg, loading, change, sub,
}: {
  label: string
  value: string
  icon: React.ElementType
  color: string
  bg: string
  loading?: boolean
  change?: { up: boolean; label: string } | null
  sub?: string
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${bg}`}>
            <Icon size={18} className={color} />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 min-h-[18px]">
          {change && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${change.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {change.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {change.label}
            </span>
          )}
          {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-md ${className}`} />
}
