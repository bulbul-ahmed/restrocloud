import { create } from 'zustand'
import type { Cart, QrView } from '../types/qr.types'

const TOKEN_KEY = (rId: string) => `qr_guest_${rId}`
const ORDER_KEY = (rId: string) => `qr_order_${rId}`

interface QrCartState {
  guestToken: string | null
  orderId: string | null
  cart: Cart | null
  view: QrView
  setGuestToken: (restaurantId: string, token: string) => void
  setOrderId: (restaurantId: string, id: string) => void
  setCart: (cart: Cart) => void
  setView: (view: QrView) => void
  loadSession: (restaurantId: string) => void
  clearSession: (restaurantId: string) => void
  itemCount: () => number
}

export const useQrCart = create<QrCartState>((set, get) => ({
  guestToken: null,
  orderId: null,
  cart: null,
  view: 'loading',

  setGuestToken: (restaurantId, token) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_KEY(restaurantId), token)
    }
    set({ guestToken: token })
  },

  setOrderId: (restaurantId, id) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ORDER_KEY(restaurantId), id)
    }
    set({ orderId: id })
  },

  setCart: (cart) => set({ cart }),

  setView: (view) => set({ view }),

  loadSession: (restaurantId) => {
    if (typeof window === 'undefined') return
    const token = sessionStorage.getItem(TOKEN_KEY(restaurantId))
    const orderId = sessionStorage.getItem(ORDER_KEY(restaurantId))
    set({ guestToken: token, orderId })
  },

  clearSession: (restaurantId) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_KEY(restaurantId))
      sessionStorage.removeItem(ORDER_KEY(restaurantId))
    }
    set({ guestToken: null, orderId: null, cart: null })
  },

  itemCount: () => get().cart?.itemCount ?? 0,
}))
