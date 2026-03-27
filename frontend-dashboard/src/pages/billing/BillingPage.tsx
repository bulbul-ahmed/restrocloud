import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, FileText, CheckCircle, AlertCircle, PauseCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getMySubscription, upgradePlan, cancelSubscription,
  reactivateSubscription, pauseSubscription, resumeSubscription, listInvoices,
} from '@/lib/billing.api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}
function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const PLAN_LABEL: Record<string, string> = {
  STARTER:    'Starter',
  GROWTH:     'Growth',
  PRO:        'Pro',
  ENTERPRISE: 'Enterprise',
}
const PLAN_COLOR: Record<string, string> = {
  STARTER:    'text-gray-500',
  GROWTH:     'text-blue-500',
  PRO:        'text-brand',
  ENTERPRISE: 'text-purple-500',
}
const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  TRIAL:     { icon: CheckCircle,  color: 'text-blue-500',   label: 'Trial' },
  ACTIVE:    { icon: CheckCircle,  color: 'text-green-500',  label: 'Active' },
  PAST_DUE:  { icon: AlertCircle,  color: 'text-red-500',    label: 'Past Due' },
  PAUSED:    { icon: PauseCircle,  color: 'text-yellow-500', label: 'Paused' },
  CANCELLED: { icon: XCircle,      color: 'text-red-400',    label: 'Cancelled' },
}

// ─── Plans ────────────────────────────────────────────────────────────────────

const PLANS = [
  { key: 'STARTER',    label: 'Starter',    monthly: 49,  annual: Math.round(49  * 12 * 0.8) },
  { key: 'GROWTH',     label: 'Growth',     monthly: 129, annual: Math.round(129 * 12 * 0.8) },
  { key: 'PRO',        label: 'Pro',        monthly: 299, annual: Math.round(299 * 12 * 0.8) },
  { key: 'ENTERPRISE', label: 'Enterprise', monthly: 0,   annual: 0 },
]

// ─── Current Plan Card ────────────────────────────────────────────────────────

function CurrentPlanCard({ sub, planFeatures, onAction }: { sub: any; planFeatures: Record<string, string[]>; onAction: () => void }) {
  const qc = useQueryClient()
  const StatusIcon = STATUS_CONFIG[sub.status]?.icon ?? CheckCircle
  const statusColor = STATUS_CONFIG[sub.status]?.color ?? 'text-gray-500'
  const statusLabel = STATUS_CONFIG[sub.status]?.label ?? sub.status

  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-subscription'] }); toast.success('Subscription will cancel at period end') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const reactivateMut = useMutation({
    mutationFn: reactivateSubscription,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-subscription'] }); toast.success('Cancellation undone') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const pauseMut = useMutation({
    mutationFn: pauseSubscription,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-subscription'] }); toast.success('Subscription paused') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const resumeMut = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-subscription'] }); toast.success('Subscription resumed') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Plan</p>
          <h2 className={`text-3xl font-bold mt-1 ${PLAN_COLOR[sub.plan] ?? 'text-gray-800'}`}>
            {PLAN_LABEL[sub.plan] ?? sub.plan}
          </h2>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${statusColor}`}>
          <StatusIcon size={16} />
          {statusLabel}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <div>
          <p className="text-xs text-gray-500">Billing</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">{sub.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Price</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">
            {sub.effectivePrice ? `${fmtUsd(sub.effectivePrice)}/${sub.billingCycle === 'ANNUAL' ? 'yr' : 'mo'}` : 'Custom'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Period Ends</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">{fmtDate(sub.currentPeriodEnd)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Credit Balance</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">{fmtUsd(sub.creditBalance ?? 0)}</p>
        </div>
      </div>

      {(planFeatures[sub.plan] ?? []).length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">What's included</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {(planFeatures[sub.plan] ?? []).map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                <CheckCircle size={12} className="text-green-500 shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {sub.cancelAtPeriodEnd && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-red-700">Subscription cancels on {fmtDate(sub.currentPeriodEnd)}</p>
          <button onClick={() => reactivateMut.mutate()} className="text-sm text-red-600 font-medium hover:underline">Undo</button>
        </div>
      )}

      {sub.status === 'PAST_DUE' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 font-medium">Your trial has ended. Upgrade to continue using all features.</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button onClick={onAction}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
          {sub.status === 'TRIAL' || sub.status === 'PAST_DUE' ? 'Choose a Plan' : 'Change Plan'}
        </button>
        {sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd && (
          <button onClick={() => pauseMut.mutate()}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Pause
          </button>
        )}
        {sub.status === 'PAUSED' && (
          <button onClick={() => resumeMut.mutate()}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            Resume
          </button>
        )}
        {sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd && (
          <button onClick={() => cancelMut.mutate()}
            className="px-4 py-2 text-red-500 text-sm hover:underline ml-auto">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Plan Picker ──────────────────────────────────────────────────────────────

function PlanPicker({ currentPlan, currentStatus, planFeatures, onClose }: { currentPlan: string; currentStatus: string; planFeatures: Record<string, string[]>; onClose: () => void }) {
  const qc = useQueryClient()
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')
  const [selected, setSelected] = useState(currentPlan)
  // During trial the user must be able to confirm the same plan (converts trial → paid)
  const onTrial = currentStatus === 'TRIAL'

  const upgradeMut = useMutation({
    mutationFn: () => upgradePlan(selected, billingCycle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-subscription'] })
      qc.invalidateQueries({ queryKey: ['my-invoices'] })
      toast.success('Plan updated successfully')
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to change plan'),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Choose a Plan</h3>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {(['MONTHLY', 'ANNUAL'] as const).map(c => (
            <button key={c} onClick={() => setBillingCycle(c)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${billingCycle === c ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
              {c === 'MONTHLY' ? 'Monthly' : 'Annual (save 20%)'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const price = billingCycle === 'ANNUAL' ? plan.annual : plan.monthly
          const isCurrentPlan = plan.key === currentPlan
          const isSelected = plan.key === selected
          return (
            <div key={plan.key}
              onClick={() => plan.key !== 'ENTERPRISE' && setSelected(plan.key)}
              className={`border rounded-xl p-4 cursor-pointer transition-all space-y-3 ${isSelected ? 'border-brand bg-brand/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'} ${plan.key === 'ENTERPRISE' ? 'cursor-default' : ''}`}>
              <div>
                <p className={`text-sm font-semibold ${PLAN_COLOR[plan.key] ?? 'text-gray-700'}`}>{plan.label}</p>
                {plan.monthly > 0 ? (
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {fmtUsd(price)}
                    <span className="text-sm font-normal text-gray-500">/{billingCycle === 'ANNUAL' ? 'yr' : 'mo'}</span>
                  </p>
                ) : (
                  <p className="text-lg font-bold text-gray-800 mt-1">Custom</p>
                )}
              </div>
              <ul className="space-y-1">
                {(planFeatures[plan.key] ?? []).map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle size={12} className="text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrentPlan && <p className="text-xs text-brand font-medium">{onTrial ? 'On trial — click to select' : 'Current plan'}</p>}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
        <button
          onClick={() => upgradeMut.mutate()}
          disabled={(selected === currentPlan && !onTrial) || selected === 'ENTERPRISE' || upgradeMut.isPending}
          className="px-5 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50">
          {upgradeMut.isPending ? 'Processing…' : 'Confirm Plan'}
        </button>
      </div>
    </div>
  )
}

// ─── Invoice History ──────────────────────────────────────────────────────────

function InvoiceHistory() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['my-invoices', page],
    queryFn: () => listInvoices(page),
    placeholderData: (prev: any) => prev,
  })

  const invoices = (data as any)?.data ?? []
  const pagination = (data as any)?.pagination

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-gray-400" />
        <h3 className="text-base font-semibold text-gray-800">Invoice History</h3>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No invoices yet</div>
      ) : (
        <>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Billing</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{fmtDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{fmtUsd(inv.amount)}</td>
                    <td className="px-4 py-3 text-gray-600">{PLAN_LABEL[inv.lineItems?.plan] ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{(inv.lineItems?.billingCycle ?? '').toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        inv.status === 'PAID'   ? 'bg-green-100 text-green-700' :
                        inv.status === 'UNPAID' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 disabled:opacity-40">Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:text-gray-700 disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [showPicker, setShowPicker] = useState(false)

  const { data: sub, isLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: getMySubscription,
  })

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <CreditCard size={22} className="text-brand" />
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Billing & Subscription</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your plan, billing cycle, and invoices</p>
        </div>
      </div>

      {sub && <CurrentPlanCard sub={sub} planFeatures={(sub as any).planFeatures ?? {}} onAction={() => setShowPicker(v => !v)} />}
      {showPicker && sub && <PlanPicker currentPlan={(sub as any).plan} currentStatus={(sub as any).status} planFeatures={(sub as any).planFeatures ?? {}} onClose={() => setShowPicker(false)} />}
      <InvoiceHistory />
    </div>
  )
}
