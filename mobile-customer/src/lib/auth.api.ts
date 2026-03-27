import { apiFetch, slugPath } from './api'
import type { AuthResponse, CustomerUser } from '../types/auth.types'

export const authApi = {
  register: (data: {
    email: string
    password: string
    firstName: string
    lastName: string
    phone?: string
  }): Promise<AuthResponse> =>
    apiFetch(slugPath('/auth/register'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch(slugPath('/auth/login'), {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: (): Promise<CustomerUser> => apiFetch(slugPath('/auth/me')),

  updateProfile: (data: {
    firstName?: string
    lastName?: string
    phone?: string
    password?: string
  }): Promise<CustomerUser> =>
    apiFetch(slugPath('/auth/me'), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  registerDeviceToken: (token: string, platform: string): Promise<void> =>
    apiFetch(slugPath('/auth/device-token'), {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  deregisterDeviceToken: (token: string): Promise<void> =>
    apiFetch(slugPath('/auth/device-token'), {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
}
