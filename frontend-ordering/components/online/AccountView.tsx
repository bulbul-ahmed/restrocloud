'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, User, ShoppingBag, Star, MapPin, Plus, Trash2,
  ChevronRight, CheckCircle, RefreshCw, X,
} from 'lucide-react'
import { toast } from 'sonner'
import * as onlineApi from '../../lib/online.api'
import { AuthExpiredError } from '../../lib/online.api'
import type {
  OnlineCustomer,
  OrderHistoryItem,
  OrderReceipt,
  LoyaltyAccount,
  SavedAddress,
} from '../../types/online.types'
import { fmtPrice } from '../../lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-slate-100 text-slate-600',
  GOLD: 'bg-yellow-100 text-yellow-700',
  PLATINUM: 'bg-indigo-100 text-indigo-700',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  SERVED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: 'Cash on Delivery',
  BKASH: 'bKash',
  SSLCOMMERZ: 'SSLCommerz',
  STRIPE: 'Card (Stripe)',
}

// ─── BD phone helpers ─────────────────────────────────────────────────────────

function phoneToLocal(phone: string): string {
  // Strips +880 prefix → returns the local part starting with 1
  if (phone.startsWith('+880')) return phone.slice(4)
  if (phone.startsWith('880')) return phone.slice(3)
  return phone
}

function localToFull(local: string): string {
  const digits = local.replace(/\D/g, '')
  if (!digits) return ''
  return `+880${digits}`
}

function formatBdPhone(phone: string): string {
  const local = phoneToLocal(phone).replace(/\D/g, '')
  if (local.length === 10) return `+880 ${local.slice(0, 2)}-${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ slug, token, customer, onUpdate }: { slug: string; token: string; customer: OnlineCustomer; onUpdate: (c: OnlineCustomer) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName ?? '',
    phoneLocal: phoneToLocal(customer.phone ?? ''),
  })
  const [saving, setSaving] = useState(false)

  // Email change state
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' })
  const [emailSaving, setEmailSaving] = useState(false)

  // Password change state
  const [pwEditing, setPwEditing] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30'

  const saveProfile = async () => {
    const digits = form.phoneLocal.replace(/\D/g, '')
    if (digits && (digits.length !== 10 || !digits.startsWith('1'))) {
      toast.error('Enter a valid BD number: 1XXXXXXXXX (10 digits)')
      return
    }
    setSaving(true)
    try {
      const updated = await onlineApi.updateMe(slug, token, {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        phone: digits ? localToFull(digits) : undefined,
      })
      onUpdate(updated)
      setEditing(false)
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const saveEmail = async () => {
    if (!emailForm.newEmail.trim()) { toast.error('Enter a new email address'); return }
    if (!emailForm.currentPassword) { toast.error('Enter your current password'); return }
    setEmailSaving(true)
    try {
      const updated = await onlineApi.updateMe(slug, token, {
        email: emailForm.newEmail.trim(),
        currentPassword: emailForm.currentPassword,
      })
      onUpdate(updated)
      setEmailEditing(false)
      setEmailForm({ newEmail: '', currentPassword: '' })
      toast.success('Email updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update email')
    } finally {
      setEmailSaving(false)
    }
  }

  const savePassword = async () => {
    if (!pwForm.currentPassword) { toast.error('Enter your current password'); return }
    if (pwForm.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await onlineApi.updateMe(slug, token, {
        currentPassword: pwForm.currentPassword,
        password: pwForm.newPassword,
      })
      setPwEditing(false)
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast.success('Password updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Personal Info ── */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Personal Info</h2>
          {!editing && (
            <button onClick={() => { setForm({ firstName: customer.firstName, lastName: customer.lastName ?? '', phoneLocal: phoneToLocal(customer.phone ?? '') }); setEditing(true) }} className="text-sm text-brand font-medium">Edit</button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">First name</label>
                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Last name</label>
                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand/30">
                <span className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-500 border-r border-gray-200 shrink-0">+880</span>
                <input
                  value={form.phoneLocal}
                  onChange={e => setForm(f => ({ ...f, phoneLocal: e.target.value.replace(/[^\d]/g, '').slice(0, 10) }))}
                  placeholder="1XXXXXXXXX"
                  className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
                  inputMode="numeric"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Enter 10 digits starting with 1 (e.g. 1712345678)</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveProfile} disabled={saving} className="flex-1 bg-brand text-white rounded-xl py-2 text-sm font-medium disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Row label="Name" value={[customer.firstName, customer.lastName].filter(Boolean).join(' ')} />
            <Row label="Phone" value={customer.phone ? formatBdPhone(customer.phone) : 'Not set'} />
          </div>
        )}
      </div>

      {/* ── Email ── */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Email Address</h2>
          {!emailEditing && (
            <button onClick={() => setEmailEditing(true)} className="text-sm text-brand font-medium">Change</button>
          )}
        </div>
        {emailEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">New email</label>
              <input
                type="email"
                value={emailForm.newEmail}
                onChange={e => setEmailForm(f => ({ ...f, newEmail: e.target.value }))}
                placeholder="new@email.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current password</label>
              <input
                type="password"
                value={emailForm.currentPassword}
                onChange={e => setEmailForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Confirm with your password"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEmail} disabled={emailSaving} className="flex-1 bg-brand text-white rounded-xl py-2 text-sm font-medium disabled:opacity-60">
                {emailSaving ? 'Saving...' : 'Update Email'}
              </button>
              <button onClick={() => { setEmailEditing(false); setEmailForm({ newEmail: '', currentPassword: '' }) }} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 font-medium">{customer.email}</p>
        )}
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Password</h2>
          {!pwEditing && (
            <button onClick={() => setPwEditing(true)} className="text-sm text-brand font-medium">Change</button>
          )}
        </div>
        {pwEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Current password</label>
              <input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">New password</label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Min 8 characters"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Confirm new password</label>
              <input
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={savePassword} disabled={pwSaving} className="flex-1 bg-brand text-white rounded-xl py-2 text-sm font-medium disabled:opacity-60">
                {pwSaving ? 'Saving...' : 'Update Password'}
              </button>
              <button onClick={() => { setPwEditing(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }) }} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">••••••••</p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}

// ─── Active status config ─────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['PENDING', 'ACCEPTED', 'PREPARING', 'READY'])

const STATUS_STEP: Record<string, number> = {
  PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, SERVED: 4,
}

const STATUS_STEPS = [
  { key: 'PENDING',   label: 'Placed' },
  { key: 'ACCEPTED',  label: 'Confirmed' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY',     label: 'Ready' },
]

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({
  slug, token, restaurantId, onReorder, onAuthExpired,
}: {
  slug: string; token: string; restaurantId: string
  onReorder: (cartToken: string) => Promise<void>
  onAuthExpired: () => void
}) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [receipts, setReceipts] = useState<Record<string, OrderReceipt>>({})
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null)
  const [reordering, setReordering] = useState<string | null>(null)

  const fetchOrders = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await onlineApi.getMyOrders(slug, token, p)
      const list: OrderHistoryItem[] = (res as any)?.orders ?? (res as any)?.data ?? []
      const meta = (res as any)?.meta ?? {}
      if (p === 1) setOrders(list)
      else setOrders(prev => [...prev, ...list])
      setTotal(meta.total ?? list.length)
    } catch (err) {
      if (err instanceof AuthExpiredError) { onAuthExpired(); return }
      toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [slug, token, onAuthExpired])

  useEffect(() => { fetchOrders(1) }, [fetchOrders])

  const toggleDetails = async (orderId: string) => {
    if (expandedId === orderId) { setExpandedId(null); return }
    setExpandedId(orderId)
    // Fetch receipt if not cached and order is completed/served
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    if (!receipts[orderId] && !ACTIVE_STATUSES.has(order.status)) {
      setReceiptLoading(orderId)
      try {
        const r = await onlineApi.getOrderReceipt(slug, token, orderId)
        setReceipts(prev => ({ ...prev, [orderId]: r }))
      } catch { /* receipt might not exist yet — ignore */ }
      finally { setReceiptLoading(null) }
    }
  }

  const handleReorder = async (orderId: string) => {
    setReordering(orderId)
    try {
      const res = await onlineApi.reorder(slug, token, orderId)
      const cartToken = (res as any)?.cartToken ?? (res as any)?.data?.cartToken
      await onReorder(cartToken)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reorder failed')
    } finally {
      setReordering(null)
    }
  }

  if (loading && orders.length === 0) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag size={36} className="mx-auto text-gray-200 mb-3" />
        <p className="text-gray-500 font-medium">No orders yet</p>
        <p className="text-sm text-gray-400 mt-1">Your order history will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const isExpanded = expandedId === order.id
        const isActive = ACTIVE_STATUSES.has(order.status)
        const receipt = receipts[order.id]
        const step = STATUS_STEP[order.status] ?? 0

        return (
          <div key={order.id} className="bg-white rounded-2xl overflow-hidden">
            {/* Card header — always visible */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">#{order.orderNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-xs text-brand font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(order.createdAt)}</p>
                  {!isExpanded && order.items?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {order.items.slice(0, 2).map(i => `${i.quantity}× ${i.name}`).join(', ')}
                      {order.items.length > 2 && ` +${order.items.length - 2} more`}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm text-gray-900">{fmtPrice(order.totalAmount, order.currency)}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleDetails(order.id)}
                  className={`flex-1 text-xs py-1.5 rounded-xl border transition-colors font-medium ${
                    isExpanded
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {isExpanded ? 'Hide Details' : 'Details'}
                </button>
                {order.status === 'COMPLETED' && (
                  <button
                    onClick={() => handleReorder(order.id)}
                    disabled={reordering === order.id}
                    className="flex-1 text-xs py-1.5 rounded-xl bg-brand text-white font-medium disabled:opacity-60"
                  >
                    {reordering === order.id ? '...' : 'Reorder'}
                  </button>
                )}
              </div>
            </div>

            {/* Expandable details */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">

                {/* Status progress bar for active orders */}
                {isActive && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-3">Order Status</p>
                    <div className="flex items-center gap-0">
                      {STATUS_STEPS.map((s, i) => {
                        const done = step > i
                        const active = step === i
                        return (
                          <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                            <div className="flex items-center w-full">
                              {i > 0 && <div className={`flex-1 h-0.5 ${done || active ? 'bg-brand' : 'bg-gray-200'}`} />}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                done ? 'bg-brand border-brand'
                                : active ? 'bg-white border-brand'
                                : 'bg-white border-gray-200'
                              }`}>
                                {done && <div className="w-2 h-2 rounded-full bg-white" />}
                                {active && <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />}
                              </div>
                              {i < STATUS_STEPS.length - 1 && <div className={`flex-1 h-0.5 ${done ? 'bg-brand' : 'bg-gray-200'}`} />}
                            </div>
                            <span className={`text-[10px] font-medium ${done || active ? 'text-brand' : 'text-gray-400'}`}>
                              {s.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Full items list */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Items</p>
                  <div className="space-y-1.5">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}× {item.name}</span>
                        {item.unitPrice !== undefined && (
                          <span className="text-gray-900 font-medium">{fmtPrice(item.unitPrice * item.quantity, order.currency)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order meta */}
                <div className="grid grid-cols-2 gap-2">
                  {(order as any).channel && (
                    <div className="bg-white rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Channel</p>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">{(order as any).channel}</p>
                    </div>
                  )}
                  {(order as any).orderType && (
                    <div className="bg-white rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">{(order as any).orderType}</p>
                    </div>
                  )}
                </div>

                {/* Receipt totals for completed orders */}
                {!isActive && (
                  receiptLoading === order.id ? (
                    <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  ) : receipt ? (
                    <div className="bg-white rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Payment Summary</p>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span><span>{fmtPrice(receipt.subtotal, receipt.currency)}</span>
                      </div>
                      {receipt.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-green-600 font-medium">
                          <span>Discount</span><span>- {fmtPrice(receipt.discountAmount, receipt.currency)}</span>
                        </div>
                      )}
                      {receipt.taxAmount > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Tax</span><span>{fmtPrice(receipt.taxAmount, receipt.currency)}</span>
                        </div>
                      )}
                      {receipt.serviceCharge > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Service charge</span><span>{fmtPrice(receipt.serviceCharge, receipt.currency)}</span>
                        </div>
                      )}
                      {receipt.tipAmount > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Tip</span><span>{fmtPrice(receipt.tipAmount, receipt.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                        <span>Total</span><span className="text-brand">{fmtPrice(receipt.totalAmount, receipt.currency)}</span>
                      </div>
                      {receipt.payments?.length > 0 && (
                        <div className="pt-1 border-t border-gray-50 space-y-1">
                          {receipt.payments.map((p, i) => (
                            <div key={i} className="flex justify-between text-xs text-gray-400">
                              <span>Paid via {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                              <span>{fmtPrice(p.amount, receipt.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )
      })}

      {orders.length < total && (
        <button
          onClick={() => { const next = page + 1; setPage(next); fetchOrders(next) }}
          disabled={loading}
          className="w-full py-3 text-sm text-gray-500 border border-gray-200 rounded-2xl hover:bg-gray-50"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}

// ─── Loyalty Tab ──────────────────────────────────────────────────────────────

function LoyaltyTab({ slug, token, onAuthExpired }: { slug: string; token: string; onAuthExpired: () => void }) {
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    onlineApi.getMyLoyalty(slug, token)
      .then(setLoyalty)
      .catch(err => {
        if (err instanceof AuthExpiredError) { onAuthExpired(); return }
        toast.error('Failed to load loyalty')
      })
      .finally(() => setLoading(false))
  }, [slug, token, onAuthExpired])

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
  if (!loyalty) return null

  const pct = loyalty.nextTierThreshold
    ? Math.min(100, Math.round((loyalty.totalEarned / loyalty.nextTierThreshold) * 100))
    : 100

  return (
    <div className="space-y-4">
      {/* Points card */}
      <div className="bg-brand rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium opacity-90">Available Points</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${TIER_COLORS[loyalty.tier] ?? 'bg-white/20 text-white'}`}>
            {loyalty.tier}
          </span>
        </div>
        <p className="text-4xl font-bold">{loyalty.points.toLocaleString()}</p>
        <p className="text-sm opacity-75 mt-1">{fmtPrice(loyalty.points, 'BDT')} redemption value</p>
      </div>

      {/* Progress to next tier */}
      {loyalty.nextTierThreshold && (
        <div className="bg-white rounded-2xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Progress to next tier</span>
            <span className="text-gray-900 font-medium">{loyalty.totalEarned.toLocaleString()} / {loyalty.nextTierThreshold.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{loyalty.totalEarned.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Earned</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{loyalty.totalRedeemed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Redeemed</p>
        </div>
      </div>

      {/* Transaction history */}
      {loyalty.transactions?.length > 0 && (
        <div className="bg-white rounded-2xl p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Recent Activity</h3>
          <div className="space-y-3">
            {loyalty.transactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{txn.description ?? txn.type}</p>
                  <p className="text-xs text-gray-400">{fmtDate(txn.createdAt)}</p>
                </div>
                <span className={`text-sm font-bold ml-3 ${txn.type === 'REDEEM' ? 'text-red-500' : 'text-green-600'}`}>
                  {txn.type === 'REDEEM' ? '-' : '+'}{txn.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Addresses Tab ────────────────────────────────────────────────────────────

function AddressesTab({ slug, token, onAuthExpired }: { slug: string; token: string; onAuthExpired: () => void }) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ label: '', line1: '', line2: '', area: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    onlineApi.getMyAddresses(slug, token)
      .then(data => setAddresses(Array.isArray(data) ? data : []))
      .catch(err => {
        if (err instanceof AuthExpiredError) { onAuthExpired(); return }
        toast.error('Failed to load addresses')
      })
      .finally(() => setLoading(false))
  }, [slug, token, onAuthExpired])

  const addAddress = async () => {
    if (!form.line1.trim() || !form.city.trim()) { toast.error('Street and city required'); return }
    setSaving(true)
    try {
      const created = await onlineApi.createAddress(slug, token, { label: form.label || undefined, line1: form.line1, line2: form.line2 || undefined, area: form.area || undefined, city: form.city })
      setAddresses(prev => [...prev, created])
      setForm({ label: '', line1: '', line2: '', area: '', city: '' })
      setShowAdd(false)
      toast.success('Address saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteAddr = async (id: string) => {
    setDeleting(id)
    try {
      await onlineApi.deleteAddress(slug, token, id)
      setAddresses(prev => prev.filter(a => a.id !== id))
    } catch { toast.error('Failed to delete') } finally { setDeleting(null) }
  }

  const setDefault = async (id: string) => {
    try {
      await onlineApi.setDefaultAddress(slug, token, id)
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })))
    } catch { toast.error('Failed to update') }
  }

  if (loading) return <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>

  return (
    <div className="space-y-3">
      {addresses.map(addr => (
        <div key={addr.id} className="bg-white rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-brand shrink-0" />
                {addr.label && <span className="text-xs font-semibold text-gray-500 uppercase">{addr.label}</span>}
                {addr.isDefault && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Default</span>}
              </div>
              <p className="text-sm text-gray-900 mt-1">{addr.line1}</p>
              {addr.line2 && <p className="text-xs text-gray-500">{addr.line2}</p>}
              <p className="text-xs text-gray-500">{[addr.area, addr.city].filter(Boolean).join(', ')}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!addr.isDefault && (
                <button onClick={() => setDefault(addr.id)} className="p-1.5 rounded-full hover:bg-gray-100" title="Set default">
                  <CheckCircle size={16} className="text-gray-400 hover:text-green-500" />
                </button>
              )}
              <button onClick={() => deleteAddr(addr.id)} disabled={deleting === addr.id} className="p-1.5 rounded-full hover:bg-gray-100">
                <Trash2 size={16} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors"
        >
          <Plus size={16} /> Add Address
        </button>
      ) : (
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">New Address</h3>
          <input
            placeholder="Label (e.g. Home, Office)"
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <input
            placeholder="Street address *"
            value={form.line1}
            onChange={e => setForm(f => ({ ...f, line1: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <input
            placeholder="Apartment / floor"
            value={form.line2}
            onChange={e => setForm(f => ({ ...f, line2: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Area"
              value={form.area}
              onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <input
              placeholder="City *"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addAddress} disabled={saving} className="flex-1 bg-brand text-white rounded-xl py-2 text-sm font-medium disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AccountView ──────────────────────────────────────────────────────────────

type AccountTab = 'profile' | 'orders' | 'loyalty' | 'addresses'

interface Props {
  slug: string
  token: string
  customer: OnlineCustomer
  restaurantId: string
  onBack: () => void
  onCustomerUpdate: (c: OnlineCustomer) => void
  onReorder: (cartToken: string) => Promise<void>
  onSessionExpired: () => void
}

export default function AccountView({ slug, token, customer, restaurantId, onBack, onCustomerUpdate, onReorder, onSessionExpired }: Props) {
  const [tab, setTab] = useState<AccountTab>('profile')

  const TABS: { id: AccountTab; label: string; Icon: React.ElementType }[] = [
    { id: 'profile', label: 'Profile', Icon: User },
    { id: 'orders', label: 'Orders', Icon: ShoppingBag },
    { id: 'loyalty', label: 'Loyalty', Icon: Star },
    { id: 'addresses', label: 'Addresses', Icon: MapPin },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900">My Account</h1>
          <p className="text-xs text-gray-400">{customer.email}</p>
        </div>
        <div className="h-9 w-9 rounded-full bg-brand text-white flex items-center justify-center font-bold text-sm">
          {customer.firstName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-5 max-w-lg mx-auto">
        {tab === 'profile' && <ProfileTab slug={slug} token={token} customer={customer} onUpdate={onCustomerUpdate} />}
        {tab === 'orders' && <OrdersTab slug={slug} token={token} restaurantId={restaurantId} onReorder={onReorder} onAuthExpired={onSessionExpired} />}
        {tab === 'loyalty' && <LoyaltyTab slug={slug} token={token} onAuthExpired={onSessionExpired} />}
        {tab === 'addresses' && <AddressesTab slug={slug} token={token} onAuthExpired={onSessionExpired} />}
      </div>
    </div>
  )
}
