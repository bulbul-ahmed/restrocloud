import { api } from '@/lib/api'
import type {
  DashboardKpis,
  RevenueData,
  ChannelData,
  PaymentMethodData,
  TopItem,
  HourlyData,
  PeriodComparison,
  AggregatorRevenue,
  AnalyticsQuery,
} from '@/types/analytics.types'

const BASE = (rid: string) => `/restaurants/${rid}/analytics`

export const analyticsApi = {
  dashboard: (rid: string): Promise<DashboardKpis> =>
    api.get(`${BASE(rid)}/dashboard`).then((r) => r.data.data),

  revenue: (rid: string, q?: AnalyticsQuery): Promise<RevenueData> =>
    api.get(`${BASE(rid)}/revenue`, { params: q }).then((r) => r.data.data),

  byChannel: (rid: string, q?: AnalyticsQuery): Promise<ChannelData[]> =>
    api.get(`${BASE(rid)}/orders/by-channel`, { params: q }).then((r) => r.data.data),

  byMethod: (rid: string, q?: AnalyticsQuery): Promise<PaymentMethodData[]> =>
    api.get(`${BASE(rid)}/payments/by-method`, { params: q }).then((r) => r.data.data),

  topItems: (rid: string, q?: AnalyticsQuery): Promise<TopItem[]> =>
    api.get(`${BASE(rid)}/menu/top-items`, { params: q }).then((r) => r.data.data),

  hourly: (rid: string, q?: AnalyticsQuery): Promise<HourlyData> =>
    api.get(`${BASE(rid)}/orders/hourly`, { params: q }).then((r) => r.data.data),

  compare: (rid: string, q?: AnalyticsQuery): Promise<PeriodComparison> =>
    api.get(`${BASE(rid)}/compare`, { params: q }).then((r) => r.data.data),

  aggregators: (rid: string, q?: { fromDate?: string; toDate?: string }): Promise<AggregatorRevenue> =>
    api.get(`/restaurants/${rid}/aggregators/revenue-report`, { params: q }).then((r) => r.data.data),

  downloadCsv: async (rid: string, q?: { dateFrom?: string; dateTo?: string }): Promise<void> => {
    const r = await api.get(`${BASE(rid)}/export`, { params: q, responseType: 'blob' })
    const url = URL.createObjectURL(r.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${q?.dateFrom ?? 'all'}-${q?.dateTo ?? 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
