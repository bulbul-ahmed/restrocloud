// M13 — Online Cart Store (localStorage-persisted per slug)
import { create } from 'zustand'
import type { OnlineCart } from '../types/online.types'

const cartTokenKey = (slug: string) => `online_cart_token_${slug}`
const orderIdKey = (slug: string) => `online_order_id_${slug}`

interface OnlineCartState {
  cart: OnlineCart | null
  cartToken: string | null
  orderId: string | null
  setCart: (slug: string, cart: OnlineCart) => void
  setCartToken: (slug: string, token: string) => void
  setOrderId: (slug: string, id: string) => void
  clearCart: (slug: string) => void
  loadPersistedTokens: (slug: string) => void
  itemCount: () => number
  subtotal: () => number
}

export const useOnlineCart = create<OnlineCartState>((set, get) => ({
  cart: null,
  cartToken: null,
  orderId: null,

  setCart: (slug, cart) => {
    const cartToken = cart.cartToken
    if (typeof window !== 'undefined' && cartToken) {
      localStorage.setItem(cartTokenKey(slug), cartToken)
    }
    set({ cart, cartToken: cartToken ?? get().cartToken })
  },

  setCartToken: (slug, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(cartTokenKey(slug), token)
    }
    set({ cartToken: token })
  },

  setOrderId: (slug, id) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(orderIdKey(slug), id)
    }
    set({ orderId: id })
  },

  clearCart: (slug) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(cartTokenKey(slug))
      localStorage.removeItem(orderIdKey(slug))
    }
    set({ cart: null, cartToken: null, orderId: null })
  },

  loadPersistedTokens: (slug) => {
    if (typeof window === 'undefined') return
    const cartToken = localStorage.getItem(cartTokenKey(slug))
    const orderId = localStorage.getItem(orderIdKey(slug))
    set({ cartToken, orderId })
  },

  itemCount: () => get().cart?.itemCount ?? 0,
  subtotal: () => get().cart?.subtotal ?? 0,
}))
