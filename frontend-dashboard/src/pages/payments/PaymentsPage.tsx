import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, DollarSign, ArrowDownLeft, TrendingDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { paymentsApi } from '@/lib/payments.api'
import { useAuthStore } from '@/store/auth.store'
import type { Payment, PaymentMethod, PaymentStatus, Refund } from '@/types/payment.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: string | number) {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_BANKING: 'Mobile Banking',
  ONLINE: 'Online',
  WALLET: 'Wallet',
  CREDIT: 'Credit',
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  CASH:          'bg-emerald-100 text-emerald-700',
  CARD:          'bg-blue-100 text-blue-700',
  MOBILE_BANKING:'bg-purple-100 text-purple-700',
  ONLINE:        'bg-indigo-100 text-indigo-700',
  WALLET:        'bg-amber-100 text-amber-700',
  CREDIT:        'bg-rose-100 text-rose-700',
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING:            'bg-yellow-100 text-yellow-700',
  COMPLETED:          'bg-emerald-100 text-emerald-700',
  FAILED:             'bg-red-100 text-red-700',
  CANCELLED:          'bg-gray-100 text-gray-600',
  PARTIALLY_REFUNDED: 'bg-orange-100 text-orange-700',
  REFUNDED:           'bg-slate-100 text-slate-600',
}

const REFUND_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED:    'bg-red-100 text-red-700',
}

// ─── Payment Detail Drawer ────────────────────────────────────────────────────

function PaymentDrawer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()

  const { data: detail, isLoading } = useQuery({
    queryKey: ['payment', payment.id],
    queryFn: () => paymentsApi.get(restaurantId!, payment.id),
  })

  const approveMutation = useMutation({
    mutationFn: (refundId: string) => paymentsApi.approveRefund(restaurantId!, payment.id, refundId),
    onSuccess: () => {
      toast.success('Refund approved')
      qc.invalidateQueries({ queryKey: ['payment', payment.id] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: () => toast.error('Failed to approve refund'),
  })

  const p = detail ?? payment

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <p className="font-semibold text-gray-900">Payment Detail</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.order?.orderNumber ?? '—'} · {fmtDate(p.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Amount */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center">
                <DollarSign size={22} className="text-brand" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{fmt(p.amount)}</p>
                <p className="text-sm text-gray-500">{p.currency}</p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', METHOD_COLORS[p.method])}>
                {METHOD_LABELS[p.method]}
              </span>
              <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', STATUS_COLORS[p.status])}>
                {p.status.replace('_', ' ')}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2">
              {[
                ['Payment ID', p.id.slice(0, 8) + '…'],
                ['Order', p.order?.orderNumber ?? '—'],
                ['Gateway', p.gatewayName ?? '—'],
                ['Gateway Tx', p.gatewayTxId ?? '—'],
                ['Notes', p.notes ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-800 font-medium text-right max-w-[60%] truncate">{value}</span>
                </div>
              ))}
            </div>

            {/* Refunds */}
            {(p.refunds ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Refunds</p>
                <div className="space-y-2">
                  {(p.refunds ?? []).map((r: Refund) => (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', REFUND_STATUS_COLORS[r.status])}>
                            {r.status}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{fmt(r.amount)}</span>
                        </div>
                        {r.reason && <p className="text-xs text-gray-500 mt-1 truncate">{r.reason}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.createdAt)}</p>
                      </div>
                      {r.status === 'PENDING' && (
                        <button
                          onClick={() => approveMutation.mutate(r.id)}
                          disabled={approveMutation.isPending}
                          className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-60 transition-colors flex-shrink-0"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            {(p.transactions ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction Log</p>
                <div className="space-y-1.5">
                  {(p.transactions ?? []).map((tx: any) => (
                    <div key={tx.id} className="flex justify-between text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                      <span>{tx.type}</span>
                      <span className="font-medium">{fmt(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary Tab ──────────────────────────────────────────────────────────────

function SummaryTab() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())

  const { data, isLoading } = useQuery({
    queryKey: ['payments-summary', restaurantId, dateFrom, dateTo],
    queryFn: () => paymentsApi.summary(restaurantId!, { dateFrom, dateTo }),
    enabled: !!restaurantId,
  })

  return (
    <div className="space-y-6">
      {/* Date filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Gross Revenue', value: fmt(data.totalGross), icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Total Refunded', value: fmt(data.totalRefunded), icon: ArrowDownLeft, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Net Revenue', value: fmt(data.totalNet), icon: TrendingDown, color: 'text-brand', bg: 'bg-brand/10' },
              { label: 'Transactions', value: String(data.totalTransactions), icon: CreditCard, color: 'text-blue-500', bg: 'bg-blue-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* By method */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-sm font-semibold text-gray-700">Breakdown by Payment Method</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="px-5 py-2.5 text-left font-medium">Method</th>
                  <th className="px-5 py-2.5 text-right font-medium">Count</th>
                  <th className="px-5 py-2.5 text-right font-medium">Gross</th>
                  <th className="px-5 py-2.5 text-right font-medium">Refunded</th>
                  <th className="px-5 py-2.5 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.byMethod.filter(m => m.count > 0).map(m => (
                  <tr key={m.method} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', METHOD_COLORS[m.method])}>
                        {METHOD_LABELS[m.method]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">{m.count}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{fmt(m.gross)}</td>
                    <td className="px-5 py-3 text-right text-red-500">{m.refunded > 0 ? fmt(m.refunded) : '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(m.net)}</td>
                  </tr>
                ))}
                {data.byMethod.every(m => m.count === 0) && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                      No payments in this date range
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Payments List Tab ────────────────────────────────────────────────────────

function PaymentsListTab() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Payment | null>(null)

  const STATUSES: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED']
  const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'MOBILE_BANKING', 'ONLINE', 'WALLET', 'CREDIT']

  const { data, isLoading } = useQuery({
    queryKey: ['payments', restaurantId, status, method, dateFrom, dateTo, page],
    queryFn: () => paymentsApi.list(restaurantId!, {
      ...(status ? { status: status as PaymentStatus } : {}),
      ...(method ? { method: method as PaymentMethod } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      page,
      limit: 20,
    }),
    enabled: !!restaurantId,
  })

  function resetFilters() {
    setStatus(''); setMethod(''); setDateFrom(''); setDateTo(''); setPage(1)
  }

  const hasFilters = !!(status || method || dateFrom || dateTo)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Status</label>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand bg-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Method</label>
          <select
            value={method}
            onChange={e => { setMethod(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand bg-white"
          >
            <option value="">All methods</option>
            {METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From</label>
          <input
            type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input
            type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand"
          />
        </div>
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-5 py-3 text-left font-medium">Order</th>
                  <th className="px-5 py-3 text-left font-medium">Method</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-right font-medium">Refunds</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-brand">
                      {p.order?.orderNumber ?? p.orderId.slice(0, 8) + '…'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', METHOD_COLORS[p.method])}>
                        {METHOD_LABELS[p.method]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[p.status])}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(p.amount)}</td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {p.refunds.length > 0 ? (
                        <span className="text-xs text-orange-600 font-medium">{p.refunds.length}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(data?.payments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-gray-400">
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  {((page - 1) * 20) + 1}–{Math.min(page * 20, data.pagination.total)} of {data.pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs px-2 text-gray-600">
                    {page} / {data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page >= data.pagination.totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selected && <PaymentDrawer payment={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Refunds Tab ──────────────────────────────────────────────────────────────

function RefundsTab() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  // Fetch all refunded/partially-refunded payments
  const { data, isLoading } = useQuery({
    queryKey: ['refunds-list', restaurantId, page],
    queryFn: async () => {
      const result = await paymentsApi.list(restaurantId!, { page, limit: 20 })
      // Filter to only payments that have refunds
      const withRefunds = result.payments.filter(p => p.refunds.length > 0)
      return { ...result, payments: withRefunds }
    },
    enabled: !!restaurantId,
  })

  const approveMutation = useMutation({
    mutationFn: ({ paymentId, refundId }: { paymentId: string; refundId: string }) =>
      paymentsApi.approveRefund(restaurantId!, paymentId, refundId),
    onSuccess: () => {
      toast.success('Refund approved')
      qc.invalidateQueries({ queryKey: ['refunds-list'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: () => toast.error('Failed to approve refund'),
  })

  // Flatten refunds from payments
  const refundRows = (data?.payments ?? []).flatMap(p =>
    p.refunds.map(r => ({ ...r, payment: p }))
  )

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 text-left font-medium">Order</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Refund Amount</th>
                <th className="px-5 py-3 text-left font-medium">Reason</th>
                <th className="px-5 py-3 text-left font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {refundRows.map(r => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-brand">
                    {r.payment.order?.orderNumber ?? r.payment.orderId.slice(0, 8) + '…'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', REFUND_STATUS_COLORS[r.status])}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmt(r.amount)}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{r.reason ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {r.status === 'PENDING' ? (
                      <button
                        onClick={() => approveMutation.mutate({ paymentId: r.payment.id, refundId: r.id })}
                        disabled={approveMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-60 transition-colors"
                      >
                        Approve
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {refundRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-gray-400">
                    No refunds found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Page {page} of {data.pagination.totalPages}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page >= data.pagination.totalPages}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'payments' | 'refunds' | 'summary'

const TABS: { id: Tab; label: string }[] = [
  { id: 'payments', label: 'Payments' },
  { id: 'refunds',  label: 'Refunds' },
  { id: 'summary',  label: 'Daily Summary' },
]

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('payments')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-0.5">View transactions, refunds, and daily revenue summary</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payments' && <PaymentsListTab />}
      {tab === 'refunds'  && <RefundsTab />}
      {tab === 'summary'  && <SummaryTab />}
    </div>
  )
}
