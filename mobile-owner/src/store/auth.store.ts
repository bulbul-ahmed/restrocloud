import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../lib/api'
import type { MobileUser } from '../types/auth.types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: MobileUser | null
  isLoaded: boolean
  setAuth: (accessToken: string, refreshToken: string, user: MobileUser) => Promise<void>
  logout: () => Promise<void>
  loadFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoaded: false,

  setAuth: async (accessToken, refreshToken, user) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken)
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
    set({ accessToken, refreshToken, user })
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
    set({ accessToken: null, refreshToken: null, user: null })
  },

  loadFromStorage: async () => {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    set({ accessToken, refreshToken, isLoaded: true })
  },
}))
