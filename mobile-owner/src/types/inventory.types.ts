export interface Ingredient {
  id: string
  name: string
  unit: string
  currentStock: number
  lowStockThreshold: number
  category?: string | null
  supplier?: string | null
}
