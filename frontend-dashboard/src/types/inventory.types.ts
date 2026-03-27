export type UnitType = 'KG' | 'G' | 'L' | 'ML' | 'PIECE' | 'DOZEN' | 'BOX' | 'PACK'
export type MovementType = 'PURCHASE' | 'SALE' | 'WASTE' | 'ADJUSTMENT' | 'STOCKTAKE'
export type POStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'

export interface Ingredient {
  id: string
  tenantId: string
  restaurantId: string
  name: string
  unit: UnitType
  category?: string
  currentStock: number
  lowStockThreshold: number
  costPerUnit: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RecipeItem {
  id: string
  itemId: string
  ingredientId: string
  quantity: number
  unit: UnitType
  ingredient: Ingredient
}

export interface StockMovement {
  id: string
  ingredientId: string
  type: MovementType
  quantity: number
  reason?: string
  notes?: string
  orderId?: string
  createdAt: string
  ingredient: { name: string; unit: string }
}

export interface Supplier {
  id: string
  name: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  isActive: boolean
}

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  ingredientId: string
  orderedQty: number
  receivedQty: number
  unitCost: number
  ingredient: Ingredient
}

export interface PurchaseOrder {
  id: string
  supplierId?: string
  status: POStatus
  orderDate: string
  expectedDate?: string
  notes?: string
  totalAmount: number
  supplier?: Supplier
  items: PurchaseOrderItem[]
}

export interface FoodCostReport {
  dateFrom?: string
  dateTo?: string
  totalRevenue: number
  totalCogs: number
  foodCostPct: number
  byIngredient: {
    ingredientId: string
    name: string
    unit: string
    totalUsedQty: number
    totalCost: number
    costPct: number
  }[]
}

export interface VarianceRow {
  ingredientId: string
  name: string
  unit: UnitType
  theoreticalQty: number
  actualQty: number
  variance: number
  variancePct: number
}
