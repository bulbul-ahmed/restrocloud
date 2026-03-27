import { api } from './api'
import type {
  Ingredient,
  RecipeItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  FoodCostReport,
  VarianceRow,
  POStatus,
  MovementType,
} from '@/types/inventory.types'

type Envelope<T> = { success: boolean; statusCode: number; data: T }

const BASE = (rid: string) => `/restaurants/${rid}/inventory`

export const inventoryApi = {
  // ── Ingredients ──────────────────────────────────────────────────────────────
  listIngredients: (rid: string, q?: { search?: string; category?: string; lowStockOnly?: string }) =>
    api.get<Envelope<Ingredient[]>>(`${BASE(rid)}/ingredients`, { params: q }).then((r) => r.data.data),

  createIngredient: (rid: string, body: Partial<Ingredient>) =>
    api.post<Envelope<Ingredient>>(`${BASE(rid)}/ingredients`, body).then((r) => r.data.data),

  updateIngredient: (rid: string, id: string, body: Partial<Ingredient>) =>
    api.patch<Envelope<Ingredient>>(`${BASE(rid)}/ingredients/${id}`, body).then((r) => r.data.data),

  deleteIngredient: (rid: string, id: string) =>
    api.delete(`${BASE(rid)}/ingredients/${id}`).then((r) => r.data),

  // ── Recipes ───────────────────────────────────────────────────────────────────
  getRecipe: (rid: string, itemId: string) =>
    api.get<Envelope<{ itemId: string; items: RecipeItem[] }>>(`${BASE(rid)}/recipes/items/${itemId}`).then((r) => r.data.data),

  setRecipe: (rid: string, itemId: string, body: { items: { ingredientId: string; quantity: number; unit: string }[] }) =>
    api.post<Envelope<{ itemId: string; items: RecipeItem[] }>>(`${BASE(rid)}/recipes/items/${itemId}`, body).then((r) => r.data.data),

  deleteRecipe: (rid: string, itemId: string) =>
    api.delete(`${BASE(rid)}/recipes/items/${itemId}`).then((r) => r.data),

  // ── Suppliers ─────────────────────────────────────────────────────────────────
  listSuppliers: (rid: string) =>
    api.get<Envelope<Supplier[]>>(`${BASE(rid)}/suppliers`).then((r) => r.data.data),

  createSupplier: (rid: string, body: Partial<Supplier>) =>
    api.post<Envelope<Supplier>>(`${BASE(rid)}/suppliers`, body).then((r) => r.data.data),

  updateSupplier: (rid: string, id: string, body: Partial<Supplier>) =>
    api.patch<Envelope<Supplier>>(`${BASE(rid)}/suppliers/${id}`, body).then((r) => r.data.data),

  deleteSupplier: (rid: string, id: string) =>
    api.delete(`${BASE(rid)}/suppliers/${id}`).then((r) => r.data),

  // ── Purchase Orders ───────────────────────────────────────────────────────────
  listPOs: (rid: string, q?: { status?: POStatus; supplierId?: string }) =>
    api.get<Envelope<PurchaseOrder[]>>(`${BASE(rid)}/purchase-orders`, { params: q }).then((r) => r.data.data),

  createPO: (rid: string, body: any) =>
    api.post<Envelope<PurchaseOrder>>(`${BASE(rid)}/purchase-orders`, body).then((r) => r.data.data),

  getPO: (rid: string, id: string) =>
    api.get<Envelope<PurchaseOrder>>(`${BASE(rid)}/purchase-orders/${id}`).then((r) => r.data.data),

  receivePO: (rid: string, id: string, body: { items: { purchaseOrderItemId: string; receivedQty: number }[] }) =>
    api.patch<Envelope<PurchaseOrder>>(`${BASE(rid)}/purchase-orders/${id}/receive`, body).then((r) => r.data.data),

  cancelPO: (rid: string, id: string) =>
    api.patch<Envelope<PurchaseOrder>>(`${BASE(rid)}/purchase-orders/${id}/cancel`).then((r) => r.data.data),

  // ── Stock ─────────────────────────────────────────────────────────────────────
  listMovements: (rid: string, q?: { ingredientId?: string; type?: MovementType; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    api.get<Envelope<{ total: number; page: number; limit: number; movements: StockMovement[] }>>(`${BASE(rid)}/stock/movements`, { params: q }).then((r) => r.data.data),

  logWaste: (rid: string, body: { ingredientId: string; quantity: number; reason: string; notes?: string }) =>
    api.post<Envelope<StockMovement>>(`${BASE(rid)}/stock/waste`, body).then((r) => r.data.data),

  stockTake: (rid: string, body: { counts: { ingredientId: string; physicalCount: number }[] }) =>
    api.post<Envelope<any[]>>(`${BASE(rid)}/stock/take`, body).then((r) => r.data.data),

  // ── Reports ───────────────────────────────────────────────────────────────────
  foodCostReport: (rid: string, q?: { dateFrom?: string; dateTo?: string }) =>
    api.get<Envelope<FoodCostReport>>(`${BASE(rid)}/reports/food-cost`, { params: q }).then((r) => r.data.data),

  varianceReport: (rid: string, q?: { dateFrom?: string; dateTo?: string }) =>
    api.get<Envelope<VarianceRow[]>>(`${BASE(rid)}/reports/variance`, { params: q }).then((r) => r.data.data),
}
