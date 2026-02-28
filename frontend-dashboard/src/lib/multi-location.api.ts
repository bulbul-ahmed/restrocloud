import { api } from '@/lib/api'
import type {
  Location,
  ConsolidatedDashboard,
  LocationComparison,
  MenuPriceOverride,
  StockTransfer,
  TenantStaff,
} from '@/types/multi-location.types'

const unwrap = (r: any) => r.data.data ?? r.data

export const multiLocationApi = {
  // ── M24.1 — Locations ────────────────────────────────────────────────────
  listLocations: (): Promise<Location[]> =>
    api.get('/tenant/locations').then(unwrap),

  createLocation: (body: {
    name: string
    slug: string
    description?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    timezone?: string
  }): Promise<Location> =>
    api.post('/tenant/locations', body).then(unwrap),

  activateLocation: (restaurantId: string): Promise<{ id: string; name: string; isActive: boolean }> =>
    api.patch(`/tenant/locations/${restaurantId}/activate`).then(unwrap),

  deactivateLocation: (restaurantId: string): Promise<{ id: string; name: string; isActive: boolean }> =>
    api.patch(`/tenant/locations/${restaurantId}/deactivate`).then(unwrap),

  // ── M24.2 — Consolidated dashboard ───────────────────────────────────────
  getConsolidated: (): Promise<ConsolidatedDashboard> =>
    api.get('/tenant/analytics/consolidated').then(unwrap),

  // ── M24.3 — Comparison ───────────────────────────────────────────────────
  getComparison: (q?: { dateFrom?: string; dateTo?: string }): Promise<LocationComparison[]> =>
    api.get('/tenant/analytics/comparison', { params: q }).then(unwrap),

  // ── M24.4 — Price overrides ───────────────────────────────────────────────
  listPriceOverrides: (restaurantId?: string): Promise<MenuPriceOverride[]> =>
    api.get('/tenant/menu/price-overrides', { params: restaurantId ? { restaurantId } : {} }).then(unwrap),

  setPriceOverride: (body: {
    restaurantId: string
    itemId: string
    price: number
  }): Promise<MenuPriceOverride> =>
    api.post('/tenant/menu/price-overrides', body).then(unwrap),

  deletePriceOverride: (id: string): Promise<{ deleted: boolean }> =>
    api.delete(`/tenant/menu/price-overrides/${id}`).then(unwrap),

  // ── M24.5 — Stock transfers ───────────────────────────────────────────────
  listStockTransfers: (q?: { restaurantId?: string; status?: string }): Promise<StockTransfer[]> =>
    api.get('/tenant/stock-transfers', { params: q }).then(unwrap),

  createStockTransfer: (body: {
    fromRestaurantId: string
    toRestaurantId: string
    ingredientId: string
    quantity: number
    notes?: string
  }): Promise<StockTransfer> =>
    api.post('/tenant/stock-transfers', body).then(unwrap),

  receiveStockTransfer: (id: string, notes?: string): Promise<StockTransfer> =>
    api.patch(`/tenant/stock-transfers/${id}/receive`, { notes }).then(unwrap),

  cancelStockTransfer: (id: string): Promise<{ cancelled: boolean }> =>
    api.patch(`/tenant/stock-transfers/${id}/cancel`).then(unwrap),

  // ── M24.7 — Staff ────────────────────────────────────────────────────────
  getAllStaff: (): Promise<TenantStaff[]> =>
    api.get('/tenant/staff').then(unwrap),

  assignStaffToLocation: (userId: string, restaurantId: string): Promise<any> =>
    api.patch(`/tenant/staff/${userId}/assign`, null, { params: { restaurantId } }).then(unwrap),
}
