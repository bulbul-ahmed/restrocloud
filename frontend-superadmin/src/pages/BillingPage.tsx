import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ToggleLeft, ToggleRight, Tag, TrendingUp, FileText, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// ─── API helpers (inline — no new types file needed) ─────────────────────────

function unwrap<T>(envelope: { success: boolean; data: T }): T { return envelope.data }

async function getSubscriptions(params?: Record<string, unknown>) {
  const { data } = await api.get('/super-admin/billing/subscriptions', { params })
  return unwrap(data as any)
}
async function getTrialConversions() {
  const { data } = await api.get('/super-admin/billing/conversions')
  return unwrap(data as any)
}
async function listCoupons() {
  const { data } = await api.get('/super-admin/billing/coupons')
  return unwrap(data as any) as any[]
}
async function createCoupon(payload: object) {
  const { data } = await api.post('/super-admin/billing/coupons', payload)
  return unwrap(data as any)
}
async function toggleCoupon(couponId: string) {
  const { data } = await api.patch(`/super-admin/billing/coupons/${couponId}/toggle`)
  return unwrap(data as any)
}
async function listInvoices(params?: Record<string, unknown>) {
  const { data } = await api.get('/super-admin/billing/invoices', { params })
  return unwrap(data as any)
}
async function createInvoice(payload: object) {
  const { data } = await api.post('/super-admin/billing/invoices', payload)
  return unwrap(data as any)
}
async function markInvoicePaid(invoiceId: string) {
  const { data } = await api.patch(`/super-admin/billing/invoices/${invoiceId}/mark-paid`)
  return unwrap(data as any)
}
async function voidInvoice(invoiceId: string) {
  const { data } = await api.patch(`/super-admin/billing/invoices/${invoiceId}/void`)
  return unwrap(data as any)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(1)}K`
  return `৳${n}`
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

const PLAN_COLORS: Record<string, string> = {
  STARTER:      'bg-slate-600/20 text-slate-400',
  PROFESSIONAL: 'bg-blue-600/20 text-blue-400',
  ENTERPRISE:   'bg-purple-600/20 text-purple-400',
}

// ─── Subscriptions Tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const [planFilter, setPlanFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)

  const params: Record<string, unknown> = { page, limit: 25 }
  if (planFilter) params.plan = planFilter
  if (activeFilter) params.isActive = activeFilter === 'true'

  const { data, isLoading } = useQuery({
    queryKey: ['billing-subs', params],
    queryFn: () => getSubscriptions(params),
    placeholderData: (prev: any) => prev,
  })

  const subs = (data as any)?.data ?? []
  const pagination = (data as any)?.pagination

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Plans</option>
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
        {pagination && <span className="text-sm text-muted-foreground ml-auto">{pagination.total} tenant{pagination.total !== 1 ? 's' : ''}</span>}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Tenant</th>
                <th className="px-4 py-3 text-left font-medium">Plan</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Trial Ends</th>
                <th className="px-4 py-3 text-left font-medium">Credit</th>
                <th className="px-4 py-3 text-left font-medium">Restaurants</th>
                <th className="px-4 py-3 text-left font-medium">Users</th>
                <th className="px-4 py-3 text-left font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subs.map((t: any) => (
                <tr key={t.id} className="hover:bg-sidebar-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PLAN_COLORS[t.plan] ?? 'bg-slate-600/20 text-slate-400'}`}>{t.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md ${t.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {t.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(t.trialEndsAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(t.creditBalance)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs text-center">{t._count?.restaurants ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs text-center">{t._count?.users ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40">Previous</button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

// ─── Conversions Tab ──────────────────────────────────────────────────────────

function ConversionsTab() {
  const { data: conv, isLoading } = useQuery({ queryKey: ['trial-conversions'], queryFn: getTrialConversions })
  const c = conv as any

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : c ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Trials Ever', value: c.totalTrials, color: 'text-foreground' },
              { label: 'Active Trials', value: c.activeTrials, color: 'text-blue-400' },
              { label: 'Expired (Unpaid)', value: c.expiredTrials, color: 'text-red-400' },
              { label: 'Converted This Month', value: c.convertedThisMonth, color: 'text-green-400' },
              { label: 'Converted Last Month', value: c.convertedLastMonth, color: 'text-muted-foreground' },
              { label: 'Conversion Rate', value: `${c.conversionRateThisMonth}%`, color: 'text-brand' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-sidebar-active border border-border rounded-xl p-4">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <TrendingUp size={18} className="text-brand" />
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{c.convertedThisMonth}</span> tenants converted from trial to paid this month
              {c.convertedLastMonth > 0 && ` vs ${c.convertedLastMonth} last month`}.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Coupons Tab ──────────────────────────────────────────────────────────────

function CouponsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', description: '', discountPct: '10', maxUses: '', expiresAt: '' })

  const { data: coupons = [], isLoading } = useQuery({ queryKey: ['coupons'], queryFn: listCoupons })

  const createMut = useMutation({
    mutationFn: () => createCoupon({
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      discountPct: Number(form.discountPct),
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      expiresAt: form.expiresAt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] })
      setShowForm(false)
      setForm({ code: '', description: '', discountPct: '10', maxUses: '', expiresAt: '' })
      toast.success('Coupon created')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create coupon'),
  })

  const toggleMut = useMutation({
    mutationFn: toggleCoupon,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons'] }); toast.success('Coupon updated') },
    onError: () => toast.error('Failed to update coupon'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(coupons as any[]).length} coupon{(coupons as any[]).length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New Coupon
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-brand/30 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Create Coupon</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="LAUNCH20"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Discount %</label>
              <input type="number" min="0" max="100" value={form.discountPct} onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Uses (blank = unlimited)</label>
              <input type="number" min="1" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="100"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Expires At (blank = never)</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Launch discount for new restaurants"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={() => createMut.mutate()} disabled={!form.code.trim()} className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50">
              <Tag size={13} /> Create
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : (coupons as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Tag size={32} className="mx-auto mb-3 opacity-30" />No coupons yet.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Discount</th>
                <th className="px-4 py-3 text-left font-medium">Uses</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(coupons as any[]).map((c: any) => (
                <tr key={c.id} className="hover:bg-sidebar-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-foreground">{c.code}</td>
                  <td className="px-4 py-3 text-green-400 font-medium">{c.discountPct}%</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ' / ∞'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(c.expiresAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{c.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleMut.mutate(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${c.isActive ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'}`}>
                      {c.isActive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PAID:   'bg-green-600/20 text-green-400',
  UNPAID: 'bg-amber-600/20 text-amber-400',
  VOID:   'bg-slate-600/20 text-slate-400',
}

interface LineItem { description: string; amount: number }

const EMPTY_FORM = {
  tenantId: '', dueAt: '', currency: 'USD', notes: '',
  lineItems: [{ description: '', amount: '' }],
}

function InvoicesTab() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const params: Record<string, unknown> = { page, limit: 25 }
  if (statusFilter) params.status = statusFilter
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ['sa-invoices', params],
    queryFn: () => listInvoices(params),
    placeholderData: (prev: any) => prev,
  })

  const invoices: any[] = (data as any)?.data ?? []
  const pagination = (data as any)?.pagination

  const createMut = useMutation({
    mutationFn: () => {
      const lineItems = form.lineItems
        .filter(li => li.description.trim() && li.amount !== '')
        .map(li => ({ description: li.description.trim(), amount: Number(li.amount) }))
      if (!lineItems.length) throw new Error('Add at least one line item')
      return createInvoice({
        tenantId: form.tenantId,
        lineItems,
        currency: form.currency || 'USD',
        dueAt: form.dueAt,
        notes: form.notes || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-invoices'] })
      setShowCreate(false)
      setForm(EMPTY_FORM)
      toast.success('Invoice created')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to create invoice'),
  })

  const paidMut = useMutation({
    mutationFn: markInvoicePaid,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-invoices'] }); toast.success('Marked as paid') },
    onError: () => toast.error('Failed to update invoice'),
  })

  const voidMut = useMutation({
    mutationFn: voidInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-invoices'] }); toast.success('Invoice voided') },
    onError: () => toast.error('Failed to void invoice'),
  })

  const setLineItem = (idx: number, field: 'description' | 'amount', value: string) => {
    setForm(f => {
      const lineItems = [...f.lineItems]
      lineItems[idx] = { ...lineItems[idx], [field]: value }
      return { ...f, lineItems }
    })
  }
  const addLineItem = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', amount: '' }] }))
  const removeLineItem = (idx: number) => setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== idx) }))
  const total = form.lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Filters + Create button */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="VOID">Void</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
        {pagination && <span className="text-sm text-muted-foreground">{pagination.total} invoice{pagination.total !== 1 ? 's' : ''}</span>}
        <button onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New Invoice
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-card border border-brand/30 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText size={15} /> Create Manual Invoice</h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Tenant ID <span className="text-red-400">*</span></label>
              <input value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                placeholder="Paste tenant UUID"
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Due Date <span className="text-red-400">*</span></label>
            <input type="date" value={form.dueAt} onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))}
              className="w-48 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Line Items</label>
              <button onClick={addLineItem} className="text-xs text-brand hover:text-brand/80 transition-colors">+ Add row</button>
            </div>
            <div className="space-y-2">
              {form.lineItems.map((li, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input value={li.description} onChange={e => setLineItem(idx, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
                  <input type="number" min="0" value={li.amount} onChange={e => setLineItem(idx, 'amount', e.target.value)}
                    placeholder="0.00"
                    className="w-28 bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
                  {form.lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(idx)} className="text-muted-foreground hover:text-red-400 transition-colors text-lg leading-none">&times;</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-semibold text-foreground mt-2">
              Total: {form.currency} {total.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Internal Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={() => createMut.mutate()}
              disabled={!form.tenantId.trim() || !form.dueAt || createMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50">
              <FileText size={13} /> {createMut.isPending ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />No invoices found.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Tenant</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Due</th>
                <th className="px-4 py-3 text-left font-medium">Paid</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-sidebar-hover transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{inv.tenant?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{inv.tenant?.slug}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {inv.currency} {Number(inv.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_COLORS[inv.status] ?? ''}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.dueAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.paidAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(inv.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inv.status === 'UNPAID' && (
                        <>
                          <button onClick={() => paidMut.mutate(inv.id)} disabled={paidMut.isPending}
                            title="Mark paid"
                            className="p-1 rounded text-green-400 hover:bg-green-600/20 transition-colors disabled:opacity-40">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => voidMut.mutate(inv.id)} disabled={voidMut.isPending}
                            title="Void invoice"
                            className="p-1 rounded text-slate-400 hover:bg-slate-600/20 transition-colors disabled:opacity-40">
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40">Previous</button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'subscriptions' | 'conversions' | 'coupons' | 'invoices'

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('subscriptions')
  const TABS: { key: Tab; label: string }[] = [
    { key: 'subscriptions', label: 'Subscriptions' },
    { key: 'conversions',   label: 'Trial Conversions' },
    { key: 'coupons',       label: 'Coupons' },
    { key: 'invoices',      label: 'Invoices' },
  ]

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Billing & Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage tenant plans, trial conversions, coupon codes, and invoices</p>
      </div>

      <div className="flex gap-1 p-1 bg-sidebar-active rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'conversions'   && <ConversionsTab />}
        {tab === 'coupons'       && <CouponsTab />}
        {tab === 'invoices'      && <InvoicesTab />}
      </div>
    </div>
  )
}
