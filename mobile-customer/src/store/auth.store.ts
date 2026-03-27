import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { ACCESS_TOKEN_KEY } from '../lib/api'
import type { CustomerUser } from '../types/auth.types'

interface AuthState {
  accessToken: string | null
  user: CustomerUser | null
  isLoaded: boolean
  cartToken: string | null
  setAuth: (accessToken: string, user: CustomerUser) => Promise<void>
  setCartToken: (token: string) => void
  logout: () => Promise<void>
  loadFromStorage: () => Promise<void>
}

const CART_TOKEN_KEY = 'restrocloud.customer.cartToken'

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isLoaded: false,
  cartToken: null,

  setAuth: async (accessToken, user) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
    set({ accessToken, user })
  },

  setCartToken: (cartToken) => {
    SecureStore.setItemAsync(CART_TOKEN_KEY, cartToken).catch(() => {})
    set({ cartToken })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
    set({ accessToken: null, user: null })
  },

  loadFromStorage: async () => {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    const cartToken = await SecureStore.getItemAsync(CART_TOKEN_KEY)
    set({ accessToken, cartToken, isLoaded: true })
  },
}))
