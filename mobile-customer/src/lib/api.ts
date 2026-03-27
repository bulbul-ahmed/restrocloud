import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../store/auth.store'
import { CONFIG } from '../constants/config'

export const ACCESS_TOKEN_KEY = 'restrocloud.customer.accessToken'

const { apiUrl: API_URL, restaurantSlug: SLUG } = CONFIG

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return (data as any)?.data ?? data
}

// Prefixed path with restaurant slug for online-ordering endpoints
export function slugPath(path: string) {
  return `/online/${SLUG}${path}`
}

export { API_URL, SLUG }
