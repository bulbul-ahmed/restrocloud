import { api } from './api'
import type {
  Category,
  MenuItem,
  ModifierGroup,
  Modifier,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateModifierGroupDto,
  UpdateModifierGroupDto,
  CreateModifierDto,
  UpdateModifierDto,
} from '@/types/menu.types'

// All backend responses are wrapped: { success, statusCode, data, timestamp }
// So r.data = the envelope; r.data.data = the actual payload.

type Envelope<T> = { success: boolean; statusCode: number; data: T }

export const menuApi = {
  // ── Categories ──────────────────────────────────────────────────────────────
  // GET /restaurants/:id/categories → Category[] (flat array)
  listCategories: (restaurantId: string) =>
    api
      .get<Envelope<Category[]>>(`/restaurants/${restaurantId}/categories`)
      .then((r) => r.data.data),

  // POST /restaurants/:id/categories → Category (isActive NOT allowed on create)
  createCategory: (restaurantId: string, dto: CreateCategoryDto) =>
    api
      .post<Envelope<Category>>(`/restaurants/${restaurantId}/categories`, dto)
      .then((r) => r.data.data),

  // PATCH /restaurants/:id/categories/:catId (backend uses PATCH, not PUT)
  updateCategory: (restaurantId: string, categoryId: string, dto: UpdateCategoryDto) =>
    api
      .patch<Envelope<Category>>(`/restaurants/${restaurantId}/categories/${categoryId}`, dto)
      .then((r) => r.data.data),

  deleteCategory: (restaurantId: string, categoryId: string) =>
    api
      .delete<Envelope<unknown>>(`/restaurants/${restaurantId}/categories/${categoryId}`)
      .then((r) => r.data.data),

  reorderCategories: (restaurantId: string, items: { id: string; sortOrder: number }[]) =>
    api
      .patch(`/restaurants/${restaurantId}/categories/reorder`, { items })
      .then((r) => r.data),

  // ── Menu Items ───────────────────────────────────────────────────────────────
  // GET /restaurants/:id/items → MenuItem[] (flat array, no pagination)
  listItems: (
    restaurantId: string,
    params?: { categoryId?: string; isAvailable?: boolean; search?: string },
  ) =>
    api
      .get<Envelope<MenuItem[]>>(`/restaurants/${restaurantId}/items`, { params })
      .then((r) => r.data.data),

  createItem: (restaurantId: string, dto: CreateMenuItemDto) =>
    api
      .post<Envelope<MenuItem>>(`/restaurants/${restaurantId}/items`, dto)
      .then((r) => r.data.data),

  updateItem: (restaurantId: string, itemId: string, dto: UpdateMenuItemDto) =>
    api
      .patch<Envelope<MenuItem>>(`/restaurants/${restaurantId}/items/${itemId}`, dto)
      .then((r) => r.data.data),

  deleteItem: (restaurantId: string, itemId: string) =>
    api
      .delete<Envelope<unknown>>(`/restaurants/${restaurantId}/items/${itemId}`)
      .then((r) => r.data.data),

  toggleAvailability: (restaurantId: string, itemId: string, isAvailable: boolean) =>
    api
      .patch<Envelope<MenuItem>>(`/restaurants/${restaurantId}/items/${itemId}/availability`, {
        isAvailable,
      })
      .then((r) => r.data.data),

  getItem: (restaurantId: string, itemId: string) =>
    api
      .get<Envelope<any>>(`/restaurants/${restaurantId}/items/${itemId}`)
      .then((r) => r.data.data),

  // POST /restaurants/:id/items/:itemId/modifier-groups  { modifierGroupId }
  attachModifierGroup: (restaurantId: string, itemId: string, groupId: string) =>
    api
      .post<Envelope<unknown>>(
        `/restaurants/${restaurantId}/items/${itemId}/modifier-groups`,
        { modifierGroupId: groupId },
      )
      .then((r) => r.data.data),

  detachModifierGroup: (restaurantId: string, itemId: string, groupId: string) =>
    api
      .delete<Envelope<unknown>>(
        `/restaurants/${restaurantId}/items/${itemId}/modifier-groups/${groupId}`,
      )
      .then((r) => r.data.data),

  // ── Modifier Groups ──────────────────────────────────────────────────────────
  // GET /restaurants/:id/modifier-groups → ModifierGroup[] (flat array)
  listModifierGroups: (restaurantId: string) =>
    api
      .get<Envelope<ModifierGroup[]>>(`/restaurants/${restaurantId}/modifier-groups`)
      .then((r) => r.data.data),

  createModifierGroup: (restaurantId: string, dto: CreateModifierGroupDto) =>
    api
      .post<Envelope<ModifierGroup>>(`/restaurants/${restaurantId}/modifier-groups`, dto)
      .then((r) => r.data.data),

  updateModifierGroup: (restaurantId: string, groupId: string, dto: UpdateModifierGroupDto) =>
    api
      .patch<Envelope<ModifierGroup>>(
        `/restaurants/${restaurantId}/modifier-groups/${groupId}`,
        dto,
      )
      .then((r) => r.data.data),

  deleteModifierGroup: (restaurantId: string, groupId: string) =>
    api
      .delete<Envelope<unknown>>(`/restaurants/${restaurantId}/modifier-groups/${groupId}`)
      .then((r) => r.data.data),

  // ── Modifiers ────────────────────────────────────────────────────────────────
  addModifier: (restaurantId: string, groupId: string, dto: CreateModifierDto) =>
    api
      .post<Envelope<Modifier>>(
        `/restaurants/${restaurantId}/modifier-groups/${groupId}/modifiers`,
        dto,
      )
      .then((r) => r.data.data),

  updateModifier: (
    restaurantId: string,
    groupId: string,
    modifierId: string,
    dto: UpdateModifierDto,
  ) =>
    api
      .patch<Envelope<Modifier>>(
        `/restaurants/${restaurantId}/modifier-groups/${groupId}/modifiers/${modifierId}`,
        dto,
      )
      .then((r) => r.data.data),

  deleteModifier: (restaurantId: string, groupId: string, modifierId: string) =>
    api
      .delete<Envelope<unknown>>(
        `/restaurants/${restaurantId}/modifier-groups/${groupId}/modifiers/${modifierId}`,
      )
      .then((r) => r.data.data),

  // ── Image upload ──────────────────────────────────────────────────────────
  uploadImage: (restaurantId: string, file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<Envelope<{ url: string }>>(`/restaurants/${restaurantId}/upload-image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.url)
  },
}
