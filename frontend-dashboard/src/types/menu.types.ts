// ─── Menu domain types ────────────────────────────────────────────────────────

export interface Category {
  id: string
  restaurantId: string
  name: string
  description?: string | null
  imageUrl?: string | null
  sortOrder: number        // backend uses sortOrder (not displayOrder)
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { items: number }
}

export interface Modifier {
  id: string
  modifierGroupId: string  // backend uses modifierGroupId (not groupId)
  name: string
  priceAdjustment: string  // Prisma returns Decimal as string
  isDefault: boolean
  isAvailable: boolean
  isRequired: boolean
  sortOrder: number
  childGroups?: ModifierGroup[]  // populated when modifier has nested sub-options
}

export interface ModifierGroup {
  id: string
  restaurantId: string
  name: string
  isRequired: boolean      // backend: isRequired (not required)
  minSelect: number        // backend: minSelect (not minSelections)
  maxSelect: number        // backend: maxSelect (not maxSelections)
  createdAt: string
  updatedAt: string
  modifiers: Modifier[]
  _count?: { itemGroups: number }
}

export interface MenuItem {
  id: string
  restaurantId: string
  categoryId: string
  category?: Pick<Category, 'id' | 'name'>
  name: string
  description?: string | null
  price: string           // Prisma returns Decimal as string
  imageUrl?: string | null
  isAvailable: boolean
  isAlcohol: boolean
  dietaryTags?: string[]  // ['vegetarian', 'halal', 'vegan', 'gluten-free']
  allergens?: string[]
  sortOrder: number
  preparationTime?: number | null
  calories?: number | null
  modifierGroups?: ModifierGroup[]
  _count?: { modifierGroups: number }
  createdAt: string
  updatedAt: string
}

// ─── Create DTOs (match backend exactly) ─────────────────────────────────────

export interface CreateCategoryDto {
  name: string
  description?: string
  imageUrl?: string
  sortOrder?: number
  // isActive NOT accepted on create — only on update
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  isActive?: boolean
}

export interface CreateMenuItemDto {
  name: string
  categoryId: string
  price: number
  description?: string
  imageUrl?: string
  isAvailable?: boolean
  isAlcohol?: boolean
  dietaryTags?: string[]
  allergens?: string[]
  preparationTime?: number
  calories?: number
  sortOrder?: number
}

export type UpdateMenuItemDto = Partial<CreateMenuItemDto>

export interface CreateModifierGroupDto {
  name: string
  isRequired?: boolean     // backend: isRequired
  minSelect?: number       // backend: minSelect
  maxSelect?: number       // backend: maxSelect
  modifiers?: CreateModifierDto[]
  parentModifierId?: string  // set to create a child (nested) group
}

export type UpdateModifierGroupDto = Partial<Omit<CreateModifierGroupDto, 'modifiers'>>

export interface CreateModifierDto {
  name: string
  priceAdjustment?: number
  isAvailable?: boolean
  isDefault?: boolean
  isRequired?: boolean
  sortOrder?: number
}

export type UpdateModifierDto = Partial<CreateModifierDto>

// ─── API response shapes ──────────────────────────────────────────────────────
// Both categories and items return flat arrays (no pagination)
