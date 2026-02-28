import { api } from '@/lib/api'

const BASE = (rid: string) => `/restaurants/${rid}/customers`
const unwrap = (r: any) => r.data.data ?? r.data

export const customersApi = {
  list: (rid: string, q?: { search?: string; page?: number; limit?: number }) =>
    api.get(BASE(rid), { params: q }).then(unwrap),

  create: (
    rid: string,
    body: {
      firstName: string
      lastName?: string
      phone?: string
      email?: string
      notes?: string
      dateOfBirth?: string
    },
  ) => api.post(BASE(rid), body).then(unwrap),

  get: (rid: string, id: string) =>
    api.get(`${BASE(rid)}/${id}`).then(unwrap),

  update: (
    rid: string,
    id: string,
    body: {
      firstName?: string
      lastName?: string
      phone?: string
      email?: string
      notes?: string
      dateOfBirth?: string
    },
  ) => api.patch(`${BASE(rid)}/${id}`, body).then(unwrap),

  toggleBlacklist: (rid: string, id: string) =>
    api.patch(`${BASE(rid)}/${id}/blacklist`).then(unwrap),

  listAddresses: (rid: string, id: string) =>
    api.get(`${BASE(rid)}/${id}/addresses`).then(unwrap),

  addAddress: (
    rid: string,
    id: string,
    body: {
      label?: string
      line1: string
      line2?: string
      city: string
      area?: string
      postalCode?: string
      isDefault?: boolean
    },
  ) => api.post(`${BASE(rid)}/${id}/addresses`, body).then(unwrap),

  updateAddress: (
    rid: string,
    id: string,
    aid: string,
    body: {
      label?: string
      line1?: string
      line2?: string
      city?: string
      area?: string
      postalCode?: string
      isDefault?: boolean
    },
  ) => api.patch(`${BASE(rid)}/${id}/addresses/${aid}`, body).then(unwrap),

  deleteAddress: (rid: string, id: string, aid: string) =>
    api.delete(`${BASE(rid)}/${id}/addresses/${aid}`).then(unwrap),

  getLoyalty: (rid: string, id: string) =>
    api.get(`${BASE(rid)}/${id}/loyalty`).then(unwrap),

  earnPoints: (
    rid: string,
    id: string,
    body: { amount?: number; points?: number; description?: string },
  ) => api.post(`${BASE(rid)}/${id}/loyalty/earn`, body).then(unwrap),

  redeemPoints: (rid: string, id: string, body: { points: number; description?: string }) =>
    api.post(`${BASE(rid)}/${id}/loyalty/redeem`, body).then(unwrap),

  getOrders: (rid: string, id: string, q?: { page?: number; limit?: number }) =>
    api.get(`${BASE(rid)}/${id}/orders`, { params: q }).then(unwrap),
}
