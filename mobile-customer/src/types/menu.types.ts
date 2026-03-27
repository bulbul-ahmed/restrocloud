export interface Restaurant {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
  currency: string
  taxRate: number
  serviceChargeRate: number
  orderTypes: string[]
  isOnlineOrderingEnabled: boolean
}

export interface MenuCategory {
  id: string
  name: string
  displayOrder: number
  items: MenuItem[]
}

export interface MenuItem {
  id: string
  name: string
  description?: string | null
  price: string
  imageUrl?: string | null
  isAvailable: boolean
  allergens?: string[]
  dietaryTags?: string[]
  modifierGroups?: ModifierGroup[]
}

export interface ModifierGroup {
  id: string
  name: string
  minSelections: number
  maxSelections: number
  isRequired: boolean
  modifiers: Modifier[]
}

export interface Modifier {
  id: string
  name: string
  priceAdjustment: number
  isAvailable: boolean
  isRequired: boolean
  childGroups?: ModifierGroup[]  // nested sub-options (up to 3 levels)
}

export interface MenuResponse {
  restaurant: Restaurant
  categories: MenuCategory[]
}
