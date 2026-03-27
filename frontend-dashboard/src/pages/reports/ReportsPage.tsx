import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Users,
  DollarSign,
  Download,
  Printer,
  Layers,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { analyticsApi } from '@/lib/analytics.api'
import { apiError, api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'summary' | 'breakdown' | 'aggregators' | 'export'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctBadge(change: number | null) {
  if (change === null) return null
  const up = change >= 0
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
        up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
      )}
    >
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{change.toFixed(1)}%
    </span>
  )
}

const CHANNEL_COLOR: Record<string, string> = {
  DINE_IN:  '#ff6b35',
  TAKEAWAY: '#3b82f6',
  DELIVERY: '#8b5cf6',
  QR:       '#f59e0b',
  ONLINE:   '#10b981',
}

const METHOD_COLOR: Record<string, string> = {
  CASH:           '#10b981',
  CARD:           '#3b82f6',
  MOBILE_BANKING: '#8b5cf6',
  ONLINE:         '#6366f1',
}

// ─── Date Range Filter ────────────────────────────────────────────────────────

function DateFilter({
  dateFrom, dateTo,
  onDateFrom, onDateTo,
}: {
  dateFrom: string; dateTo: string
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFrom(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, change, iconBg,
}: {
  icon: React.ElementType; label: string; value: string
  change?: number | null; iconBg: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={cn('p-2.5 rounded-lg', iconBg)}>
            <Icon size={20} className="text-white" />
          </div>
          {change !== undefined && pctBadge(change ?? null)}
        </div>
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab({ rid, q }: { rid: string; q: { dateFrom?: string; dateTo?: string } }) {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['analytics-dashboard', rid],
    queryFn: () => analyticsApi.dashboard(rid),
  })
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', rid, q],
    queryFn: () => analyticsApi.revenue(rid, q),
  })
  const { data: compare } = useQuery({
    queryKey: ['analytics-compare', rid, q],
    queryFn: () => analyticsApi.compare(rid, q),
  })

  if (dashLoading || revLoading) {
    return <div className="py-12 text-center text-gray-400">Loading analytics…</div>
  }

  const kpis = dashboard?.today
  const changes = compare?.changes

  const chartData = (revenue?.daily ?? []).map((d) => ({
    date: String(d.date).split('T')[0],
    revenue: d.revenue,
    orders: d.orders,
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={DollarSign}
          label="Total Revenue (today)"
          value={formatCurrency(kpis?.revenue ?? 0)}
          change={compare?.changes.revenue ?? null}
          iconBg="bg-orange-500"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Total Orders (today)"
          value={String(kpis?.orders ?? 0)}
          change={changes?.orders ?? null}
          iconBg="bg-blue-500"
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg Order Value"
          value={formatCurrency(kpis?.avgOrderValue ?? 0)}
          change={changes?.avgOrderValue ?? null}
          iconBg="bg-violet-500"
        />
        <KpiCard
          icon={Users}
          label="New Customers"
          value={String(kpis?.newCustomers ?? 0)}
          change={changes?.newCustomers ?? null}
          iconBg="bg-emerald-500"
        />
      </div>

      {/* Revenue vs Yesterday callout */}
      {dashboard?.vsYesterday && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-lg px-4 py-3">
          <span className="text-sm text-gray-600">
            Yesterday's revenue:{' '}
            <strong>{formatCurrency(dashboard.vsYesterday.yesterdayRevenue)}</strong>
          </span>
          {pctBadge(dashboard.vsYesterday.revenueChange)}
          <span className="text-sm text-gray-400">vs today</span>
        </div>
      )}

      {/* Daily trend chart */}
      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Revenue & Orders Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis yAxisId="rev" orientation="left" tick={{ fontSize: 11, fill: '#9ca3af' }} width={55} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} width={35} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'revenue' ? [formatCurrency(value), 'Revenue'] : [value, 'Orders']
                  }
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#ff6b35"
                  strokeWidth={2}
                  dot={false}
                  name="revenue"
                />
                <Line
                  yAxisId="ord"
                  type="monotone"
                  dataKey="orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="orders"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Period comparison summary */}
      {compare && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Period Comparison</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                { label: 'Revenue', curr: formatCurrency(compare.currentPeriod.revenue), prev: formatCurrency(compare.previousPeriod.revenue), change: compare.changes.revenue },
                { label: 'Orders', curr: String(compare.currentPeriod.orders), prev: String(compare.previousPeriod.orders), change: compare.changes.orders },
                { label: 'Avg Order Value', curr: formatCurrency(compare.currentPeriod.avgOrderValue), prev: formatCurrency(compare.previousPeriod.avgOrderValue), change: compare.changes.avgOrderValue },
                { label: 'New Customers', curr: String(compare.currentPeriod.newCustomers), prev: String(compare.previousPeriod.newCustomers), change: compare.changes.newCustomers },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-gray-500 text-xs mb-1">{row.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900">{row.curr}</span>
                    <span className="text-gray-400 text-xs">prev: {row.prev}</span>
                    {pctBadge(row.change ?? null)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Breakdown Tab ─────────────────────────────────────────────────────────────

function BreakdownTab({ rid, q }: { rid: string; q: { dateFrom?: string; dateTo?: string } }) {
  const { data: channels, isLoading: chLoading } = useQuery({
    queryKey: ['analytics-channel', rid, q],
    queryFn: () => analyticsApi.byChannel(rid, q),
  })
  const { data: methods, isLoading: methLoading } = useQuery({
    queryKey: ['analytics-method', rid, q],
    queryFn: () => analyticsApi.byMethod(rid, q),
  })
  const { data: topItems, isLoading: itemLoading } = useQuery({
    queryKey: ['analytics-top-items', rid, q],
    queryFn: () => analyticsApi.topItems(rid, { ...q, limit: 10 }),
  })
  const { data: hourly, isLoading: hrLoading } = useQuery({
    queryKey: ['analytics-hourly', rid, q],
    queryFn: () => analyticsApi.hourly(rid, q),
  })

  const totalChannelOrders = (channels ?? []).reduce((s, c) => s + c.orders, 0)
  const totalMethodRev = (methods ?? []).reduce((s, m) => s + m.revenue, 0)

  const barData = (hourly?.heatmap ?? []).map((h) => ({
    label: h.label,
    orders: h.orders,
    isPeak: h.hour === hourly?.peakHour?.hour,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Channel */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales by Channel</h3>
            {chLoading ? (
              <div className="text-gray-400 text-sm">Loading…</div>
            ) : (channels ?? []).length === 0 ? (
              <div className="text-gray-400 text-sm">No data</div>
            ) : (
              <div className="space-y-3">
                {(channels ?? []).map((c) => {
                  const pct = totalChannelOrders > 0 ? (c.orders / totalChannelOrders) * 100 : 0
                  const color = CHANNEL_COLOR[c.channel] ?? '#94a3b8'
                  return (
                    <div key={c.channel}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{c.channel.replace('_', ' ')}</span>
                        <span className="text-gray-500">{c.orders} orders · {formatCurrency(c.revenue)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales by Payment Method</h3>
            {methLoading ? (
              <div className="text-gray-400 text-sm">Loading…</div>
            ) : (methods ?? []).length === 0 ? (
              <div className="text-gray-400 text-sm">No data</div>
            ) : (
              <div className="space-y-3">
                {(methods ?? []).map((m) => {
                  const pct = totalMethodRev > 0 ? (m.revenue / totalMethodRev) * 100 : 0
                  const color = METHOD_COLOR[m.method] ?? '#94a3b8'
                  return (
                    <div key={m.method}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{m.method.replace('_', ' ')}</span>
                        <span className="text-gray-500">{m.transactions} txns · {formatCurrency(m.revenue)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct.toFixed(1)}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Heatmap */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Hourly Order Heatmap</h3>
            {hourly?.peakHour && (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full border border-orange-100">
                Peak: {hourly.peakHour.label} ({hourly.peakHour.orders} orders)
              </span>
            )}
          </div>
          {hrLoading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  interval={2}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={28} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="orders"
                  name="Orders"
                  fill="#ff6b35"
                  radius={[2, 2, 0, 0]}
                  opacity={0.85}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Items */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Items</h3>
          {itemLoading ? (
            <div className="text-gray-400 text-sm">Loading…</div>
          ) : (topItems ?? []).length === 0 ? (
            <div className="text-gray-400 text-sm">No data</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-xs text-gray-400 font-medium w-10">#</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium">Item</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Qty</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(topItems ?? []).map((item, idx) => (
                  <tr
                    key={item.rank}
                    className={cn(
                      'border-b border-gray-50',
                      idx === 0 && 'bg-orange-50',
                    )}
                  >
                    <td className="py-2.5 text-gray-400">{item.rank}</td>
                    <td className="py-2.5 font-medium text-gray-800">{item.name}</td>
                    <td className="py-2.5 text-right font-bold text-gray-900">{item.totalQty}</td>
                    <td className="py-2.5 text-right text-gray-700">{formatCurrency(item.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Aggregators Tab ──────────────────────────────────────────────────────────

function AggregatorsTab({ rid, dateFrom, dateTo }: { rid: string; dateFrom: string; dateTo: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-aggregators', rid, dateFrom, dateTo],
    queryFn: () => analyticsApi.aggregators(rid, {
      fromDate: dateFrom || undefined,
      toDate: dateTo || undefined,
    }),
  })

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading aggregator data…</div>
  if (!data) return null

  const { platforms, summary } = data

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.totalOrders}</p>
            <p className="text-xs text-gray-500 mt-1">Total Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">Gross Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCommission)}</p>
            <p className="text-xs text-gray-500 mt-1">Total Commission</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform table */}
      {platforms.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No aggregator connections found.</div>
      ) : (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Platform Breakdown</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-xs text-gray-400 font-medium">Platform</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Orders</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Gross Rev</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Commission</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Net Rev</th>
                  <th className="pb-2 text-xs text-gray-400 font-medium text-right">Comm %</th>
                  <th className="pb-2 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => {
                  const commPct = p.totalRevenue > 0
                    ? ((p.totalCommission / p.totalRevenue) * 100).toFixed(1)
                    : '0.0'
                  const netPct = p.totalRevenue > 0
                    ? (p.netRevenue / p.totalRevenue) * 100
                    : 0
                  return (
                    <tr key={p.platform} className="border-b border-gray-50">
                      <td className="py-3 font-medium text-gray-800">{p.displayName}</td>
                      <td className="py-3 text-right">{p.totalOrders}</td>
                      <td className="py-3 text-right">{formatCurrency(p.totalRevenue)}</td>
                      <td className="py-3 text-right text-red-600">{formatCurrency(p.totalCommission)}</td>
                      <td className="py-3 text-right font-semibold text-green-700">{formatCurrency(p.netRevenue)}</td>
                      <td className="py-3 text-right text-gray-500">{commPct}%</td>
                      <td className="py-3">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${netPct.toFixed(1)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Export Tab ────────────────────────────────────────────────────────────────

function ExportTab({
  rid,
  dateFrom,
  dateTo,
}: {
  rid: string
  dateFrom: string
  dateTo: string
}) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await analyticsApi.downloadCsv(rid, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      toast.success('Report downloaded')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-orange-50">
              <Download size={24} className="text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Download CSV Report</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Export a multi-section CSV including Revenue Summary, Daily Breakdown, Sales by
                Channel, Payment Methods, and Top Items for the selected date range.
              </p>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleDownload} disabled={downloading}>
                  <Download size={16} className="mr-2" />
                  {downloading ? 'Preparing…' : 'Download CSV'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <Printer size={24} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Print Report</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Opens your browser's print dialog. Use "Save as PDF" to create a PDF version of the
                current page.
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer size={16} className="mr-2" />
                  Print / Save as PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
        <strong className="text-gray-700">Report includes:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Revenue Summary (total revenue, total orders, avg daily revenue)</li>
          <li>Daily Breakdown (day-by-day revenue and order counts)</li>
          <li>Sales by Channel (DINE_IN, TAKEAWAY, DELIVERY, QR, ONLINE)</li>
          <li>Payment Method Breakdown</li>
          <li>Top 20 Items by quantity sold</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('summary')

  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const defaultTo   = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo]     = useState(defaultTo)

  const rid = user?.restaurantId ?? ''
  const q = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'summary',     label: 'Summary',     icon: TrendingUp },
    { id: 'breakdown',   label: 'Breakdown',   icon: Layers },
    { id: 'aggregators', label: 'Aggregators', icon: Globe },
    { id: 'export',      label: 'Export',      icon: Download },
  ]

  return (
    <PageShell
      title="Reports"
      actions={<DateFilter dateFrom={dateFrom} dateTo={dateTo} onDateFrom={setDateFrom} onDateTo={setDateTo} />}
    >
      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              tab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'summary'     && <SummaryTab rid={rid} q={q} />}
      {tab === 'breakdown'   && <BreakdownTab rid={rid} q={q} />}
      {tab === 'aggregators' && <AggregatorsTab rid={rid} dateFrom={dateFrom} dateTo={dateTo} />}
      {tab === 'export'      && <ExportTab rid={rid} dateFrom={dateFrom} dateTo={dateTo} />}
    </PageShell>
  )
}
