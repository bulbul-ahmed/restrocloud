import { apiFetch } from './api'
import type { Ingredient } from '../types/inventory.types'

export const inventoryApi = {
  listIngredients: (rid: string, lowStockOnly = false): Promise<Ingredient[]> =>
    apiFetch(`/restaurants/${rid}/inventory/ingredients${lowStockOnly ? '?lowStockOnly=true' : ''}`),
}
