export interface DashboardKpis {
  today: {
    revenue: number
    orders: number
    completedOrders: number
    avgOrderValue: number
    newCustomers: number
    activeTableSessions: number
    pendingOrders: number
  }
  vsYesterday: {
    yesterdayRevenue: number
    revenueChange: number | null
  }
}

export interface DailyRow {
  date: string
  revenue: number
  orders: number
}

export interface RevenueData {
  dateFrom: string
  dateTo: string
  totalRevenue: number
  totalOrders: number
  avgDailyRevenue: number
  daily: DailyRow[]
}

export interface ChannelData {
  channel: string
  orders: number
  revenue: number
}

export interface PaymentMethodData {
  method: string
  transactions: number
  revenue: number
  percentage: number
}

export interface TopItem {
  rank: number
  itemId: string | null
  name: string
  totalQty: number
  totalRevenue: number
}

export interface HourlyRow {
  hour: number
  label: string
  orders: number
  revenue: number
}

export interface HourlyData {
  heatmap: HourlyRow[]
  peakHour: HourlyRow
}

export interface PeriodStats {
  from: string
  to: string
  revenue: number
  orders: number
  completedOrders: number
  avgOrderValue: number
  newCustomers: number
}

export interface PeriodComparison {
  currentPeriod: PeriodStats
  previousPeriod: PeriodStats
  changes: {
    revenue: number | null
    orders: number | null
    avgOrderValue: number | null
    newCustomers: number | null
  }
}

export interface AggregatorPlatform {
  platform: string
  displayName: string
  totalOrders: number
  totalRevenue: number
  totalCommission: number
  netRevenue: number
}

export interface AggregatorRevenue {
  platforms: AggregatorPlatform[]
  summary: {
    totalRevenue: number
    totalCommission: number
    totalOrders: number
  }
}

export interface AnalyticsQuery {
  dateFrom?: string
  dateTo?: string
  limit?: number
}
