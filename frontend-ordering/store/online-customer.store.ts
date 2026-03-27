// M13 — Online Customer Auth Store (localStorage-persisted per slug)
import { create } from 'zustand'
import type { OnlineCustomer } from '../types/online.types'

const tokenKey = (slug: string) => `online_token_${slug}`
const customerKey = (slug: string) => `online_customer_${slug}`

interface OnlineCustomerState {
  token: string | null
  customer: OnlineCustomer | null
  setAuth: (slug: string, token: string, customer: OnlineCustomer) => void
  clearAuth: (slug: string) => void
  loadAuth: (slug: string) => void
}

export const useOnlineCustomer = create<OnlineCustomerState>((set) => ({
  token: null,
  customer: null,

  setAuth: (slug, token, customer) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(tokenKey(slug), token)
      localStorage.setItem(customerKey(slug), JSON.stringify(customer))
    }
    set({ token, customer })
  },

  clearAuth: (slug) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(tokenKey(slug))
      localStorage.removeItem(customerKey(slug))
    }
    set({ token: null, customer: null })
  },

  loadAuth: (slug) => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem(tokenKey(slug))
    if (token) {
      // Clear expired JWT — avoids silent 401s on every account API call
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem(tokenKey(slug))
          localStorage.removeItem(customerKey(slug))
          set({ token: null, customer: null })
          return
        }
      } catch { /* malformed token — fall through to clear */ }
    }
    const raw = localStorage.getItem(customerKey(slug))
    const customer = raw ? (JSON.parse(raw) as OnlineCustomer) : null
    set({ token, customer })
  },
}))
