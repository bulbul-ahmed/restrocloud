import { apiFetch } from './api'
import type { MenuItem } from '../types/menu.types'

export const menuApi = {
  listItems: (rid: string): Promise<MenuItem[]> =>
    apiFetch(`/restaurants/${rid}/menu/items`),

  toggleAvailability: (rid: string, itemId: string, isAvailable: boolean): Promise<MenuItem> =>
    apiFetch(`/restaurants/${rid}/menu/items/${itemId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }),
}
