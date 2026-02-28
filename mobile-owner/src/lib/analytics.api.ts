import { apiFetch } from './api'
import type { DashboardKPIs } from '../types/analytics.types'

export const analyticsApi = {
  getDashboard: (rid: string): Promise<DashboardKPIs> =>
    apiFetch(`/restaurants/${rid}/analytics/dashboard`),
}
