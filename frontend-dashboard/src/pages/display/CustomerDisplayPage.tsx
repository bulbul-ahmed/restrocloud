import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

interface DisplayOrder {
  id: string
  orderNumber: string
  updatedAt: string
  guestName?: string | null
}

interface DisplayData {
  restaurant: { id: string; name: string; logoUrl?: string | null } | null
  ready: DisplayOrder[]
  recentlyServed: DisplayOrder[]
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  return `${mins}m ago`
}

export default function CustomerDisplayPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>()
  const [data, setData] = useState<DisplayData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [tick, setTick] = useState(0)

  async function fetchDisplay() {
    if (!restaurantId) return
    try {
      const res = await fetch(`${API_BASE}/display/${restaurantId}`)
      if (!res.ok) return
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
    } catch {
      // silently ignore — display stays showing last known state
    }
  }

  // Initial fetch + poll every 15s
  useEffect(() => {
    fetchDisplay()
    const id = setInterval(fetchDisplay, 15_000)
    return () => clearInterval(id)
  }, [restaurantId])

  // Tick every 30s to re-render "timeAgo" labels
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  void tick // used only to trigger re-render

  const ready = data?.ready ?? []
  const recentlyServed = data?.recentlyServed ?? []
  const restaurantName = data?.restaurant?.name ?? 'RestroCloud'

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-gray-800">
        <div className="flex items-center gap-4">
          {data?.restaurant?.logoUrl && (
            <img src={data.restaurant.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          )}
          <div>
            <p className="text-lg font-bold text-white">{restaurantName}</p>
            <p className="text-xs text-gray-400">Order Collection Display</p>
          </div>
        </div>
        <div className="text-right">
          <Clock />
          <p className="text-xs text-gray-500 mt-0.5">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 divide-x divide-gray-800">

        {/* LEFT — Now Serving (READY) */}
        <div className="flex-1 flex flex-col">
          <div className="px-10 pt-8 pb-4 flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <h2 className="text-xl font-bold text-green-400 tracking-wide uppercase">Now Serving</h2>
            {ready.length > 0 && (
              <span className="ml-2 bg-green-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                {ready.length}
              </span>
            )}
          </div>

          <div className="flex-1 px-10 pb-8">
            {ready.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-base">No orders ready yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {ready.map((order) => (
                  <div
                    key={order.id}
                    className="bg-green-500/10 border-2 border-green-500/40 rounded-2xl px-6 py-5 flex flex-col gap-1"
                  >
                    <p className="text-4xl font-black text-green-400 tracking-tight leading-none">
                      {order.orderNumber}
                    </p>
                    {order.guestName && (
                      <p className="text-sm text-gray-400 mt-1">{order.guestName}</p>
                    )}
                    <p className="text-xs text-gray-500">{timeAgo(order.updatedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Recently Collected */}
        <div className="w-72 flex flex-col bg-gray-900/50">
          <div className="px-6 pt-8 pb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Recently Collected</h2>
          </div>
          <div className="flex-1 px-6 pb-8 space-y-2 overflow-y-auto">
            {recentlyServed.length === 0 ? (
              <p className="text-sm text-gray-600 mt-4">None yet</p>
            ) : (
              recentlyServed.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-800"
                >
                  <span className="text-lg font-bold text-gray-500">{order.orderNumber}</span>
                  <span className="text-xs text-gray-600">{timeAgo(order.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-10 py-3 border-t border-gray-800 flex items-center justify-between">
        <p className="text-xs text-gray-600">Please collect your order at the counter when your number is called.</p>
        <p className="text-xs text-gray-700">Auto-refreshes every 15 seconds</p>
      </div>
    </div>
  )
}

// ── Live clock ──────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <p className="text-2xl font-bold tabular-nums text-white">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </p>
  )
}
