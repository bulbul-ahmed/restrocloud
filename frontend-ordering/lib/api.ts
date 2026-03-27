const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data as any)?.data ?? data
}
