import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SuperAdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'SUPER_ADMIN'
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: SuperAdminUser | null
  isAuthenticated: boolean

  setAuth: (accessToken: string, refreshToken: string, user: SuperAdminUser) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'restrocloud-superadmin-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
)
