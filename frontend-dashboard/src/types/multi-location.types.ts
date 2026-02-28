export interface Location {
  id: string
  name: string
  slug: string
  description?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  timezone: string
  isActive: boolean
  createdAt: string
  _count: { orders: number; users: number }
}

export interface ConsolidatedDashboard {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  locationCount: number
  locations: LocationKpi[]
}

export interface LocationKpi {
  restaurantId: string
  name: string
  todayOrders: number
  todayRevenue: number
  avgOrderValue: number
}

export interface LocationComparison {
  rank: number
  restaurantId: string
  name: string
  city?: string | null
  revenue: number
  orders: number
  avgOrderValue: number
  customers: number
  staff: number
}

export interface MenuPriceOverride {
  id: string
  tenantId: string
  restaurantId: string
  itemId: string
  price: string
  createdAt: string
}

export interface StockTransfer {
  id: string
  tenantId: string
  fromRestaurantId: string
  toRestaurantId: string
  ingredientId: string
  quantity: number
  notes?: string | null
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED'
  initiatedBy: string
  receivedBy?: string | null
  receivedAt?: string | null
  createdAt: string
  fromName: string
  toName: string
  ingredient?: { name: string; unit: string } | null
}

export interface TenantStaff {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  role: string
  restaurantId?: string | null
  restaurantName?: string | null
  isActive: boolean
  lastLoginAt?: string | null
  createdAt: string
}
