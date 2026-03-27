import { useEffect, useState } from 'react'
import { Building2, Users, DollarSign, ShoppingCart, Activity, Database, Zap, TrendingDown, RefreshCw, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPlatformKpis, getSystemHealth } from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import type { PlatformKpis, SystemHealth } from '@/types/superadmin.types'
import { toast } from 'sonner'

function fmt(n: number) {
  if (n >= 1_000_000) return `৳${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(1)}K`
  return `৳${n.toFixed(0)}`
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<PlatformKpis | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPlatformKpis(), getSystemHealth()])
      .then(([k, h]) => { setKpis(k); setHealth(h) })
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const stats = kpis
    ? [
        {
          label: 'Total Tenants',
          value: kpis.tenants.total.toString(),
          sub: `${kpis.tenants.active} active · ${kpis.tenants.suspended} suspended`,
          icon: Users,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          label: 'Total Restaurants',
          value: kpis.restaurants.total.toString(),
          sub: `+${kpis.tenants.newThisMonth} tenants this month`,
          icon: Building2,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Orders Today',
          value: kpis.orders.today.toString(),
          sub: fmt(kpis.orders.todayRevenue) + ' revenue today',
          icon: ShoppingCart,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          label: 'All-Time Revenue',
          value: fmt(kpis.orders.allTimeRevenue),
          sub: `${kpis.users.total} total users`,
          icon: DollarSign,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
        },
        {
          label: 'Active Users Now',
          value: kpis.growth.activeUsersNow.toString(),
          sub: 'Logged in within last 15 min',
          icon: UserCheck,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: 'Trial Conversions',
          value: kpis.growth.convertedThisMonth.toString(),
          sub: 'Trials converted to paid this month',
          icon: RefreshCw,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
        },
        {
          label: 'Churn This Month',
          value: kpis.growth.churnedThisMonth.toString(),
          sub: `vs ${kpis.growth.churnedLastMonth} last month`,
          icon: TrendingDown,
          color: kpis.growth.churnedThisMonth === 0 ? 'text-emerald-600' : 'text-red-600',
          bg: kpis.growth.churnedThisMonth === 0 ? 'bg-emerald-50' : 'bg-red-50',
        },
      ]
    : []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="text-gray-500 mt-1">RestroCloud platform metrics and health</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="h-16 animate-pulse bg-gray-100 rounded" />
                </CardContent>
              </Card>
            ))
          : stats.map((s) => {
              const Icon = s.icon
              return (
                <Card key={s.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">{s.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                      </div>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                        <Icon size={20} className={s.color} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity size={16} className="text-emerald-500" />
            System Health
            {health && (
              <span
                className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {health.status}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-12 animate-pulse bg-gray-100 rounded" />
          ) : health ? (
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <Database size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Database</p>
                  <p className="text-sm font-medium text-gray-900">
                    {health.checks.database.status === 'healthy'
                      ? `${health.checks.database.latencyMs}ms`
                      : 'Unhealthy'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap size={16} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Redis</p>
                  <p className="text-sm font-medium text-gray-900">
                    {health.checks.redis.status === 'healthy'
                      ? `${health.checks.redis.latencyMs}ms`
                      : 'Unhealthy'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-400 self-end ml-auto">
                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
