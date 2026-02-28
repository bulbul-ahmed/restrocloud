export interface DashboardKPIs {
  today: {
    revenue: number
    orders: number
    completedOrders: number
    avgOrderValue: number
    pendingOrders: number
    activeTableSessions: number
  }
  vsYesterday: {
    yesterdayRevenue: number
    revenueChange: number
  }
}
