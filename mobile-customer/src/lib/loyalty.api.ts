import { apiFetch, slugPath } from './api'
import type { LoyaltyDashboard, Address, CustomerNotification } from '../types/loyalty.types'

export const loyaltyApi = {
  getDashboard: (): Promise<LoyaltyDashboard> =>
    apiFetch(slugPath('/my/loyalty')),

  listAddresses: (): Promise<Address[]> =>
    apiFetch(slugPath('/my/addresses')),

  createAddress: (data: {
    street: string
    city: string
    postalCode?: string
    country?: string
    isDefault?: boolean
  }): Promise<Address> =>
    apiFetch(slugPath('/my/addresses'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAddress: (addressId: string, data: Partial<Address>): Promise<Address> =>
    apiFetch(slugPath(`/my/addresses/${addressId}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAddress: (addressId: string): Promise<void> =>
    apiFetch(slugPath(`/my/addresses/${addressId}`), { method: 'DELETE' }),

  setDefaultAddress: (addressId: string): Promise<Address> =>
    apiFetch(slugPath(`/my/addresses/${addressId}/default`), { method: 'PATCH' }),

  listNotifications: (page = 1, limit = 20): Promise<{ notifications: CustomerNotification[]; total: number }> =>
    apiFetch(slugPath(`/my/notifications?page=${page}&limit=${limit}`)),

  markRead: (notifId: string): Promise<void> =>
    apiFetch(slugPath(`/my/notifications/${notifId}/read`), { method: 'PATCH' }),

  markAllRead: (): Promise<void> =>
    apiFetch(slugPath('/my/notifications/read-all'), { method: 'PATCH' }),

  deleteAccount: (password: string): Promise<void> =>
    apiFetch(slugPath('/my/account'), {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
}
