import { apiFetch, slugPath } from './api'
import type { MenuResponse, MenuItem, Restaurant } from '../types/menu.types'

export const menuApi = {
  getRestaurant: (): Promise<Restaurant> => apiFetch(slugPath('')),

  getMenu: (): Promise<MenuResponse> => apiFetch(slugPath('/menu')),

  getItem: (itemId: string): Promise<MenuItem> =>
    apiFetch(slugPath(`/menu/items/${itemId}`)),
}
