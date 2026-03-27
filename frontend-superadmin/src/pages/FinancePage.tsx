import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Flag, CalendarX, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getFinanceOverview, getFinancePlanBreakdown, getOutstandingAccounts, getGmvTrend, listSaRefunds, getTaxReport } from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import type { FinanceOverview, FinancePlanRow, OutstandingAccounts, GmvTrendPoint, SaRefund, TaxReport } from '@/types/superadmin.types'

const PLAN_COLOR: Record<string, string> = {
  STARTER: 'bg-gray-100 text-gray-700',
  GROWTH: 'bg-blue-100 text-blue-700',
  PRO: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-indigo-100 text-indigo-700',
}

function fmt(n: number) {
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(1)}K`
  return `৳${n.toFixed(0)}`
}

function StatCard({
  label, value, sub, icon: Icon, trend,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  trend?: number | null
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">{label}</span>
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Icon size={16} className="text-indigo-600" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}% vs last month
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simple bar chart using div widths
function BarChart({ data }: { data: GmvTrendPoint[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">No data</p>
  const max = Math.max(...data.map((d) => d.gmv), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const pct = (d.gmv / max) * 100
        const label = new Date(d.month).toLocaleDateString('en', { month: 'short' })
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-600"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            <span className="text-xs text-gray-400">{label}</span>
            {/* tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              {fmt(d.gmv)} · {d.orders} orders
            </div>
          </div>
        )
      })}
    </div>
  )
}

const REFUND_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

function RefundsTab() {
  const [refunds, setRefunds] = useState<SaRefund[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const limit = 20

  function load(p = page) {
    setLoading(true)
    listSaRefunds({ status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: p, limit })
      .then((res) => { setRefunds(res.data); setTotal(res.pagination.total) })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1); setPage(1) }, [status, dateFrom, dateTo]) // eslint-disable-line

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button onClick={() => load(page)} className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
        <span className="ml-auto text-sm text-gray-500 self-center">{total} refunds</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tenant / Restaurant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Reason</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.tenant?.name ?? r.tenantId}</p>
                      <p className="text-xs text-gray-400">{r.restaurant?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${REFUND_STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{r.currency} {r.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!loading && refunds.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400">No refunds found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-end gap-2">
          <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">Page {page} / {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => { const p = page + 1; setPage(p); load(p) }}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  )
}

function TaxReportTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [report, setReport] = useState<TaxReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getTaxReport(year)
      .then(setReport)
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false))
  }, [year])

  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toFixed(2)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Year</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {report && (
          <div className="ml-auto flex gap-6 text-sm">
            <span className="text-gray-500">Total Tax Collected: <span className="font-bold text-gray-900">{fmt(report.grandTotalTax)}</span></span>
            <span className="text-gray-500">Total GMV: <span className="font-bold text-gray-900">{fmt(report.grandTotalGmv)}</span></span>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Country</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Tenants</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Orders</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total GMV</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total Tax</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Eff. Tax Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report?.rows.map((r) => (
                  <tr key={r.country} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.country}</td>
                    <td className="px-4 py-3 text-right">{r.tenantCount}</td>
                    <td className="px-4 py-3 text-right">{r.orderCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.totalGmv)}</td>
                    <td className="px-4 py-3 text-right font-medium text-indigo-700">{fmt(r.totalTax)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{r.effectiveTaxRate.toFixed(2)}%</td>
                  </tr>
                ))}
                {!loading && (!report || report.rows.length === 0) && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">No tax data for {year}.</td></tr>
                )}
              </tbody>
              {report && report.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-gray-50 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">{report.rows.reduce((s, r) => s + r.orderCount, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{fmt(report.grandTotalGmv)}</td>
                    <td className="px-4 py-3 text-right text-indigo-700">{fmt(report.grandTotalTax)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {report.grandTotalGmv > 0 ? ((report.grandTotalTax / report.grandTotalGmv) * 100).toFixed(2) : '0.00'}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type Tab = 'overview' | 'plans' | 'outstanding' | 'refunds' | 'tax'

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [plans, setPlans] = useState<FinancePlanRow[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingAccounts | null>(null)
  const [trend, setTrend] = useState<GmvTrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getFinanceOverview(),
      getFinancePlanBreakdown(),
      getOutstandingAccounts(),
      getGmvTrend(),
    ])
      .then(([ov, pl, os, tr]) => {
        setOverview(ov)
        setPlans(pl)
        setOutstanding(os)
        setTrend(tr)
      })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'plans', label: 'Plan Breakdown' },
    { id: 'outstanding', label: `Outstanding ${outstanding ? `(${outstanding.summary.trialExpiredCount + outstanding.summary.suspendedCount + outstanding.summary.flaggedCount})` : ''}` },
    { id: 'refunds', label: 'Refunds' },
    { id: 'tax', label: 'Tax Report' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
        <p className="text-gray-500 mt-1">Platform revenue, MRR, GMV, and account health</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-gray-100 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Overview Tab ───────────────────────────────────────────── */}
          {tab === 'overview' && overview && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="MRR"
                  value={fmt(overview.mrr)}
                  sub="Monthly Recurring Revenue"
                  icon={DollarSign}
                />
                <StatCard
                  label="ARR"
                  value={fmt(overview.arr)}
                  sub="Annual Recurring Revenue"
                  icon={TrendingUp}
                />
                <StatCard
                  label="GMV This Month"
                  value={fmt(overview.gmv.thisMonth)}
                  sub={`YTD: ${fmt(overview.gmv.ytd)}`}
                  icon={DollarSign}
                  trend={overview.gmv.momChangePercent}
                />
                <StatCard
                  label="Paid Subscribers"
                  value={String(overview.totalActiveSubscribers)}
                  sub={`${overview.signups.thisMonth} new · ${overview.churn.thisMonth} churned this month`}
                  icon={Users}
                />
              </div>

              {/* Plan distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Plan Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overview.planBreakdown.map((p) => (
                        <div key={p.plan} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLOR[p.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                              {p.plan}
                            </span>
                            <span className="text-sm text-gray-600">{p.count} tenants</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{fmt(p.mrr)}/mo</p>
                            <p className="text-xs text-gray-400">{fmt(p.monthlyPrice)} × {p.count}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* GMV trend chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">GMV — Last 12 Months</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChart data={trend} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── Plan Breakdown Tab ─────────────────────────────────────── */}
          {tab === 'plans' && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Tenants</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">GMV (period)</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Orders</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Avg GMV / tenant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plans.map((p) => (
                      <tr key={p.plan} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLOR[p.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                            {p.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{p.tenantCount}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(p.gmv)}</td>
                        <td className="px-4 py-3 text-right">{p.orderCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {p.tenantCount > 0 ? fmt(p.gmv / p.tenantCount) : '—'}
                        </td>
                      </tr>
                    ))}
                    {plans.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ── Outstanding Tab ────────────────────────────────────────── */}
          {tab === 'outstanding' && outstanding && (
            <div className="space-y-6">
              {/* Summary badges */}
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <CalendarX size={15} className="text-red-500" />
                  <span className="text-sm font-medium text-red-700">
                    {outstanding.summary.trialExpiredCount} trial expired
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <span className="text-sm font-medium text-amber-700">
                    {outstanding.summary.suspendedCount} suspended
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <Flag size={15} className="text-orange-500" />
                  <span className="text-sm font-medium text-orange-700">
                    {outstanding.summary.flaggedCount} flagged
                  </span>
                </div>
              </div>

              {/* Trial expired */}
              {outstanding.trialExpired.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <CalendarX size={15} className="text-red-500" /> Trial Expired
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Tenant</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Plan</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Expired</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Days overdue</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Restaurants</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {outstanding.trialExpired.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <p className="font-medium">{t.name}</p>
                                <p className="text-xs text-gray-400">{t.slug}</p>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="secondary">{t.plan}</Badge>
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">
                                {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="text-red-600 font-medium">{t.daysSinceExpiry}d</span>
                              </td>
                              <td className="px-4 py-2 text-right">{t.restaurantCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Suspended */}
              {outstanding.suspended.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-500" /> Suspended Accounts
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Tenant</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Plan</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Suspended</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Restaurants</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {outstanding.suspended.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <p className="font-medium">{t.name}</p>
                                <p className="text-xs text-gray-400">{t.slug}</p>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="secondary">{t.plan}</Badge>
                              </td>
                              <td className="px-4 py-2 text-right text-xs text-gray-500">
                                {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-2 text-right">{t.restaurantCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Flagged */}
              {outstanding.flagged.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Flag size={15} className="text-orange-500" /> Flagged for Review
                  </h3>
                  <Card>
                    <CardContent className="p-0">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Tenant</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Plan</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-500">Reason</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-500">Restaurants</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {outstanding.flagged.map((t) => (
                            <tr key={t.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <p className="font-medium">{t.name}</p>
                                <p className="text-xs text-gray-400">{t.slug}</p>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant="secondary">{t.plan}</Badge>
                              </td>
                              <td className="px-4 py-2 text-gray-500 text-xs">{t.flagReason ?? '—'}</td>
                              <td className="px-4 py-2 text-right">{t.restaurantCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {outstanding.trialExpired.length === 0 && outstanding.suspended.length === 0 && outstanding.flagged.length === 0 && (
                <p className="text-center text-gray-400 py-12">All accounts are in good standing.</p>
              )}
            </div>
          )}

          {/* ── Refunds Tab ────────────────────────────────────────────── */}
          {tab === 'refunds' && <RefundsTab />}

          {/* ── Tax Report Tab ─────────────────────────────────────────── */}
          {tab === 'tax' && <TaxReportTab />}
        </>
      )}
    </div>
  )
}
