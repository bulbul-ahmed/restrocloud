import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AlertTriangle, TrendingDown, Users, Cpu } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CohortData {
  cohorts: {
    cohortMonth: string
    size: number
    retention: { month: string; count: number; pct: number }[]
  }[]
  allMonths: string[]
}

interface FeatureAdoptionData {
  totalActiveTenants: number
  features: { name: string; count: number; pct: number }[]
}

interface AtRiskTenant {
  tenantId: string
  name: string
  slug: string
  plan: string
  ownerEmail: string | null
  lastLoginAt: string | null
  trialEndsAt: string | null
  ordersThisWeek: number
  ordersPrevWeek: number
  signals: string[]
}

interface AtRiskData {
  count: number
  tenants: AtRiskTenant[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function unwrap<T>(envelope: { success: boolean; data: T }): T {
  return envelope.data
}

async function getCohortRetention(): Promise<CohortData> {
  const { data } = await api.get<{ success: boolean; data: CohortData }>('/super-admin/analytics/cohorts')
  return unwrap(data)
}

async function getFeatureAdoption(): Promise<FeatureAdoptionData> {
  const { data } = await api.get<{ success: boolean; data: FeatureAdoptionData }>('/super-admin/analytics/feature-adoption')
  return unwrap(data)
}

async function getAtRiskTenants(): Promise<AtRiskData> {
  const { data } = await api.get<{ success: boolean; data: AtRiskData }>('/super-admin/analytics/at-risk')
  return unwrap(data)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatColor(pct: number) {
  if (pct === 0) return 'bg-slate-800 text-slate-600'
  if (pct < 20) return 'bg-red-900/40 text-red-400'
  if (pct < 40) return 'bg-orange-900/40 text-orange-400'
  if (pct < 60) return 'bg-yellow-900/40 text-yellow-400'
  if (pct < 80) return 'bg-lime-900/40 text-lime-400'
  return 'bg-green-900/40 text-green-400'
}

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-slate-600/20 text-slate-400',
  PROFESSIONAL: 'bg-blue-600/20 text-blue-400',
  ENTERPRISE: 'bg-indigo-600/20 text-indigo-400',
}

// ─── Cohort Retention Heatmap ─────────────────────────────────────────────────

function CohortHeatmap() {
  const { data, isLoading } = useQuery({ queryKey: ['cohort-retention'], queryFn: getCohortRetention })

  if (isLoading) return <div className="h-48 animate-pulse bg-sidebar-active rounded-xl" />
  if (!data || data.cohorts.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No cohort data yet — orders required</p>
  }

  const months = data.allMonths

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate border-spacing-0.5 min-w-max">
        <thead>
          <tr>
            <th className="text-left text-muted-foreground font-medium px-2 py-1 w-24">Cohort</th>
            <th className="text-right text-muted-foreground font-medium px-2 py-1 w-12">Size</th>
            {months.map(m => (
              <th key={m} className="text-center text-muted-foreground font-medium px-1 py-1 w-12">{m.slice(5)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cohorts.map(cohort => {
            const retMap: Record<string, number> = {}
            cohort.retention.forEach(r => { retMap[r.month] = r.pct })
            return (
              <tr key={cohort.cohortMonth}>
                <td className="text-muted-foreground px-2 py-0.5 font-mono">{cohort.cohortMonth}</td>
                <td className="text-right text-foreground px-2 py-0.5">{cohort.size}</td>
                {months.map(m => {
                  if (m < cohort.cohortMonth) {
                    return <td key={m} className="px-1 py-0.5" />
                  }
                  const pct = retMap[m] ?? 0
                  return (
                    <td key={m} className="px-1 py-0.5">
                      <div className={`rounded text-center py-1 font-medium ${heatColor(pct)}`}>
                        {pct > 0 ? `${pct}%` : '—'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Feature Adoption Bars ────────────────────────────────────────────────────

function FeatureAdoptionChart() {
  const { data, isLoading } = useQuery({ queryKey: ['feature-adoption'], queryFn: getFeatureAdoption })

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(7)].map((_, i) => <div key={i} className="h-8 animate-pulse bg-sidebar-active rounded" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Based on {data.totalActiveTenants} active tenants</p>
      {data.features.map(f => (
        <div key={f.name} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-foreground">{f.name}</span>
            <span className="text-muted-foreground">{f.count} / {data.totalActiveTenants} ({f.pct}%)</span>
          </div>
          <div className="h-2 bg-sidebar-active rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${f.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── At-Risk Tenants ──────────────────────────────────────────────────────────

function AtRiskList() {
  const { data, isLoading } = useQuery({ queryKey: ['at-risk-tenants'], queryFn: getAtRiskTenants })

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-sidebar-active rounded-xl" />)}
    </div>
  )
  if (!data || data.count === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No at-risk tenants detected</p>
  }

  return (
    <div className="space-y-3">
      {data.tenants.map(t => (
        <div key={t.tenantId} className="bg-sidebar-active rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[t.plan] ?? 'bg-slate-600/20 text-slate-400'}`}>
                  {t.plan}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{t.ownerEmail ?? 'No owner email'}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {t.signals.map((s, i) => (
                  <span key={i} className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={10} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0 text-xs text-muted-foreground">
              <p>This wk: <span className="text-foreground font-medium">{t.ordersThisWeek}</span></p>
              <p>Prev wk: <span className="text-foreground font-medium">{t.ordersPrevWeek}</span></p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const { data: atRisk } = useQuery({ queryKey: ['at-risk-tenants'], queryFn: getAtRiskTenants })

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">Cohort retention, feature adoption, and at-risk tenant signals</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-600/20">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">At-Risk Tenants</p>
            <p className="text-2xl font-bold text-foreground">{atRisk?.count ?? '—'}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600/20">
            <Cpu size={18} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Feature Modules</p>
            <p className="text-2xl font-bold text-foreground">7</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-600/20">
            <Users size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cohort Analysis</p>
            <p className="text-2xl font-bold text-foreground">Live</p>
          </div>
        </div>
      </div>

      {/* Cohort Retention */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-foreground">Cohort Retention Heatmap</h2>
        </div>
        <p className="text-xs text-muted-foreground">% of sign-up cohort that placed orders in each subsequent month</p>
        <CohortHeatmap />
      </div>

      {/* Feature Adoption */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-foreground">Feature Adoption</h2>
        </div>
        <FeatureAdoptionChart />
      </div>

      {/* At-Risk Tenants */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <h2 className="text-sm font-semibold text-foreground">At-Risk Tenants</h2>
          {atRisk && atRisk.count > 0 && (
            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">{atRisk.count} flagged</span>
          )}
        </div>
        <AtRiskList />
      </div>
    </div>
  )
}
