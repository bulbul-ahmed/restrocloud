import { create } from 'zustand'
import type { Cart } from '../types/cart.types'

interface CartState {
  cart: Cart | null
  restaurantId: string | null
  setCart: (cart: Cart) => void
  setRestaurantId: (id: string) => void
  clearCart: () => void
  itemCount: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  restaurantId: null,

  setCart: (cart) => set({ cart }),
  setRestaurantId: (restaurantId) => set({ restaurantId }),
  clearCart: () => set({ cart: null }),

  itemCount: () => {
    const items = get().cart?.items ?? []
    return items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))
