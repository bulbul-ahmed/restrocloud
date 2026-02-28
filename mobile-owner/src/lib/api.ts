import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../store/auth.store'

const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000/api'

const ACCESS_TOKEN_KEY = 'restrocloud.accessToken'
const REFRESH_TOKEN_KEY = 'restrocloud.refreshToken'

// ── Simple fetch wrapper with auth + refresh ──────────────────────────────────

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    if (!refreshToken) return null

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      useAuthStore.getState().logout()
      return null
    }

    const data = await res.json()
    const newToken = data.data?.accessToken ?? data.accessToken
    if (newToken) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newToken)
    }
    return newToken ?? null
  } catch {
    useAuthStore.getState().logout()
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    // Refresh token and retry once
    if (!isRefreshing) {
      isRefreshing = true
      const newToken = await refreshAccessToken()
      isRefreshing = false
      refreshQueue.forEach((cb) => cb(newToken ?? ''))
      refreshQueue = []

      if (!newToken) throw new Error('Unauthorized')

      headers['Authorization'] = `Bearer ${newToken}`
      const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers })
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}))
        throw new Error(err?.message ?? `HTTP ${retryRes.status}`)
      }
      const retryData = await retryRes.json()
      return retryData?.data ?? retryData
    } else {
      // Queue concurrent requests while refresh is in progress
      return new Promise((resolve, reject) => {
        refreshQueue.push(async (newToken) => {
          if (!newToken) return reject(new Error('Unauthorized'))
          headers['Authorization'] = `Bearer ${newToken}`
          const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers })
          const retryData = await retryRes.json()
          resolve(retryData?.data ?? retryData)
        })
      })
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message ?? `HTTP ${res.status}`)
  }

  const data = await res.json()
  return data?.data ?? data
}

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, API_URL }
