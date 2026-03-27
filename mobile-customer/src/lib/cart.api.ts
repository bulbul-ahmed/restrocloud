import { apiFetch, slugPath } from './api'
import type { Cart } from '../types/cart.types'

export const cartApi = {
  init: (restaurantId: string): Promise<{ cartToken: string }> =>
    apiFetch(`${slugPath('/cart/init')}?restaurantId=${restaurantId}`),

  getCart: (restaurantId: string, cartToken: string): Promise<Cart> =>
    apiFetch(`${slugPath('/cart')}?restaurantId=${restaurantId}&cartToken=${cartToken}`),

  addItem: (
    restaurantId: string,
    cartToken: string,
    item: {
      itemId: string
      quantity: number
      modifiers?: Array<{ modifierId: string; modifierGroupId: string }>
      notes?: string
    },
  ): Promise<Cart> =>
    apiFetch(
      `${slugPath('/cart/items')}?restaurantId=${restaurantId}&cartToken=${cartToken}`,
      { method: 'POST', body: JSON.stringify(item) },
    ),

  updateItem: (
    cartItemId: string,
    restaurantId: string,
    cartToken: string,
    quantity: number,
  ): Promise<Cart> =>
    apiFetch(
      `${slugPath(`/cart/${cartItemId}`)}?restaurantId=${restaurantId}&cartToken=${cartToken}`,
      { method: 'PATCH', body: JSON.stringify({ quantity }) },
    ),

  removeItem: (
    cartItemId: string,
    restaurantId: string,
    cartToken: string,
  ): Promise<Cart> =>
    apiFetch(`${slugPath(`/cart/${cartItemId}`)}?restaurantId=${restaurantId}&cartToken=${cartToken}`, {
      method: 'DELETE',
    }),
}
