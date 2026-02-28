import { apiFetch } from './api'
import type { MobileUser, AuthResponse } from '../types/auth.types'

export const authApi = {
  login: (identifier: string, password: string): Promise<AuthResponse> =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  getMe: (): Promise<MobileUser> => apiFetch('/auth/me'),

  refreshToken: (refreshToken: string): Promise<{ accessToken: string }> =>
    apiFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
}
