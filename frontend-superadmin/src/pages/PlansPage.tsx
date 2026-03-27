import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPlans, updatePlan } from '@/lib/superadmin.api'
import type { Plan, UpdatePlanPayload } from '@/types/superadmin.types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FEATURE_LABELS: Record<string, string> = {
  kds: 'Kitchen Display System',
  tables: 'Table Management',
  pos: 'Point of Sale',
  delivery: 'Delivery Management',
  inventory: 'Inventory & Stock',
  crm: 'CRM & Loyalty',
  analytics: 'Advanced Analytics',
  aggregators: 'Aggregator Integration',
  onlineOrdering: 'Online Ordering',
  multiLocation: 'Multi-Location',
  qrOrdering: 'QR Table Ordering',
  customReports: 'Custom Reports',
  apiAccess: 'API Access',
  whiteLabel: 'White Label',
  dedicatedSupport: 'Dedicated Support',
}

// These features have a real PlanGuard on their backend controllers —
// toggling them here actually blocks or allows API access.
const ENFORCED_FEATURES = new Set([
  'delivery', 'inventory', 'crm', 'analytics', 'aggregators', 'multiLocation',
])

const TIER_CONFIG: Record<string, {
  card: string
  topBar: string
  badge: string
  priceColor: string
  saveColor: string
}> = {
  STARTER: {
    card:       'bg-white border-slate-200',
    topBar:     'bg-slate-500',
    badge:      'bg-slate-100 text-slate-700 border border-slate-200',
    priceColor: 'text-slate-900',
    saveColor:  'text-slate-500',
  },
  GROWTH: {
    card:       'bg-white border-emerald-200',
    topBar:     'bg-emerald-500',
    badge:      'bg-emerald-50 text-emerald-700 border border-emerald-200',
    priceColor: 'text-slate-900',
    saveColor:  'text-emerald-600',
  },
  PRO: {
    card:       'bg-white border-brand-300',
    topBar:     'bg-brand-500',
    badge:      'bg-brand-50 text-brand-700 border border-brand-200',
    priceColor: 'text-slate-900',
    saveColor:  'text-brand-600',
  },
  ENTERPRISE: {
    card:       'bg-white border-amber-200',
    topBar:     'bg-amber-500',
    badge:      'bg-amber-50 text-amber-700 border border-amber-200',
    priceColor: 'text-slate-900',
    saveColor:  'text-amber-600',
  },
}

function EditPlanModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<UpdatePlanPayload>({
    name: plan.name,
    priceMonthly: plan.priceMonthly,
    priceAnnual: plan.priceAnnual,
    currency: plan.currency,
    maxLocations: plan.maxLocations,
    maxUsers: plan.maxUsers,
    features: { ...plan.features },
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    sortOrder: plan.sortOrder,
  })

  const mutation = useMutation({
    mutationFn: () => updatePlan(plan.tier, form),
    onSuccess: () => {
      toast.success(`${plan.name} plan updated`)
      qc.invalidateQueries({ queryKey: ['plans'] })
      onClose()
    },
    onError: () => toast.error('Failed to update plan'),
  })

  const setFeature = (key: string, val: boolean) =>
    setForm(f => ({ ...f, features: { ...f.features, [key]: val } }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit {plan.name} Plan</h2>
            <p className="text-sm text-slate-400 mt-0.5">Tier: {plan.tier}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                value={form.currency ?? 'USD'}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              />
            </div>
          </div>

          {/* Pricing */}
          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Pricing</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Monthly Price</label>
                <input
                  type="number" min="0"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  value={form.priceMonthly ?? 0}
                  onChange={e => setForm(f => ({ ...f, priceMonthly: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Annual Price (total)</label>
                <input
                  type="number" min="0"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  value={form.priceAnnual ?? 0}
                  onChange={e => setForm(f => ({ ...f, priceAnnual: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Limits <span className="text-slate-500 font-normal">(-1 = unlimited)</span></p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Locations</label>
                <input
                  type="number" min="-1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  value={form.maxLocations ?? -1}
                  onChange={e => setForm(f => ({ ...f, maxLocations: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Users</label>
                <input
                  type="number" min="-1"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                  value={form.maxUsers ?? -1}
                  onChange={e => setForm(f => ({ ...f, maxUsers: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-medium text-slate-300">Features</p>
              <span className="text-xs text-slate-500">🔒 = API-enforced (actual blocking)</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setFeature(key, !(form.features?.[key] ?? false))}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0',
                      form.features?.[key]
                        ? 'bg-brand border-brand'
                        : 'bg-slate-800 border-slate-600 group-hover:border-slate-500',
                    )}
                  >
                    {form.features?.[key] && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-slate-300">
                    {label}
                    {ENFORCED_FEATURES.has(key) && <span className="ml-1 text-amber-400" title="Backend guard enforced">🔒</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Status toggles */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand"
                checked={form.isActive ?? true}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              />
              <span className="text-sm text-slate-300">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand"
                checked={form.isPublic ?? true}
                onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
              />
              <span className="text-sm text-slate-300">Publicly visible on pricing page</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
  const cfg = TIER_CONFIG[plan.tier] ?? TIER_CONFIG.STARTER
  const annualSavings = plan.priceMonthly > 0
    ? Math.round(((plan.priceMonthly * 12 - plan.priceAnnual) / (plan.priceMonthly * 12)) * 100)
    : 0

  const enabledFeatures = Object.entries(plan.features ?? {}).filter(([, v]) => v).map(([k]) => k)
  const disabledFeatures = Object.entries(plan.features ?? {}).filter(([, v]) => !v).map(([k]) => k)

  return (
    <div className={cn('rounded-xl border shadow-sm flex flex-col overflow-hidden', cfg.card)}>
      {/* Colored top accent bar */}
      <div className={cn('h-1.5 w-full flex-shrink-0', cfg.topBar)} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full', cfg.badge)}>
                {plan.tier}
              </span>
              {!plan.isActive && (
                <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Inactive</span>
              )}
              {!plan.isPublic && (
                <span className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">Hidden</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
          </div>
          <button
            onClick={onEdit}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors border border-slate-200 hover:border-slate-400 bg-white px-3 py-1 rounded-lg font-medium"
          >
            Edit
          </button>
        </div>

        {/* Pricing */}
        <div className="flex items-end gap-3">
          <div>
            <p className={cn('text-3xl font-bold', cfg.priceColor)}>
              {plan.priceMonthly === 0 ? 'Custom' : `$${plan.priceMonthly}`}
            </p>
            {plan.priceMonthly > 0 && <p className="text-xs text-slate-400 mt-0.5">/month</p>}
          </div>
          {plan.priceMonthly > 0 && annualSavings > 0 && (
            <div className="mb-1">
              <p className="text-sm text-slate-500">${plan.priceAnnual}/yr</p>
              <p className={cn('text-xs font-medium', cfg.saveColor)}>Save {annualSavings}% annually</p>
            </div>
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-slate-400 mb-0.5">Locations</p>
            <p className="font-semibold text-slate-800">{plan.maxLocations === -1 ? 'Unlimited' : plan.maxLocations}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-slate-400 mb-0.5">Users</p>
            <p className="font-semibold text-slate-800">{plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers}</p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          {enabledFeatures.map(key => (
            <div key={key} className="flex items-center gap-2 text-xs text-slate-700">
              <span className="text-emerald-500 font-bold flex-shrink-0">✓</span>
              <span>{FEATURE_LABELS[key] ?? key}</span>
              {ENFORCED_FEATURES.has(key) && <span className="text-amber-500 text-[10px]" title="API-enforced">🔒</span>}
            </div>
          ))}
          {disabledFeatures.map(key => (
            <div key={key} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex-shrink-0">–</span>
              <span>{FEATURE_LABELS[key] ?? key}</span>
              {ENFORCED_FEATURES.has(key) && <span className="text-slate-300 text-[10px]" title="API-enforced">🔒</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PlansPage() {
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Plan Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configure pricing, limits, and features for each subscription tier</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {plans && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map(plan => (
            <PlanCard key={plan.tier} plan={plan} onEdit={() => setEditingPlan(plan)} />
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-sm text-slate-600">
          <span className="text-slate-800 font-semibold">Note:</span> Plan changes take effect immediately for new sign-ups.
          Existing tenants keep their current plan until manually changed or they upgrade.
          Price changes do not retroactively affect active subscriptions.
        </p>
      </div>

      {editingPlan && (
        <EditPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} />
      )}
    </div>
  )
}
