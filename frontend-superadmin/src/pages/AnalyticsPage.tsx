import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPlatformRevenue } from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import type { PlatformRevenue, RevenueDataPoint } from '@/types/superadmin.types'

type GroupBy = 'day' | 'week' | 'month'

function toIsoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toIsoDate(d)
}

function defaultTo() {
  return toIsoDate(new Date())
}

export default function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(defaultFrom())
  const [dateTo, setDateTo] = useState(defaultTo())
  const [groupBy, setGroupBy] = useState<GroupBy>('day')
  const [data, setData] = useState<PlatformRevenue | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPlatformRevenue({ dateFrom, dateTo, groupBy })
      setData(res)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, groupBy])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-500 mt-1">Revenue and order trends across all tenants</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Group By</label>
          <div className="flex border rounded-md overflow-hidden">
            {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  groupBy === g
                    ? 'bg-brand text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={load} loading={loading} variant="outline" className="self-end">
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ৳{data.summary.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {data.summary.totalOrders.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by {groupBy}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Revenue (৳)</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Orders</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Active Tenants</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="px-4 py-3">
                          <div className="h-4 animate-pulse bg-gray-100 rounded" />
                        </td>
                      </tr>
                    ))
                  : data && data.data.length === 0
                  ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No data for selected period
                      </td>
                    </tr>
                  )
                  : data?.data.map((row: RevenueDataPoint, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {typeof row.date === 'string'
                            ? row.date.split('T')[0]
                            : new Date(row.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {row.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.orders}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.activeTenants}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
