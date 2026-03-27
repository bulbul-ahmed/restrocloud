'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, UtensilsCrossed } from 'lucide-react'
import { listRestaurants } from '../lib/online.api'
import type { OnlineRestaurantSummary } from '../types/online.types'
import RestaurantCard from '../components/online/RestaurantCard'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-32 bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-5 bg-gray-100 rounded-full w-16" />
          <div className="h-5 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [restaurants, setRestaurants] = useState<OnlineRestaurantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRestaurants = async (s: string, c: string, p: number) => {
    setLoading(true)
    try {
      const result = await listRestaurants({ search: s || undefined, city: c || undefined, page: p, limit: 12 })
      const items = result?.data ?? []
      const meta = result?.meta
      if (p === 1) {
        setRestaurants(items)
      } else {
        setRestaurants((prev) => [...prev, ...items])
      }
      if (meta) {
        setHasMore(p * meta.limit < meta.total)
      } else {
        setHasMore(false)
      }
    } catch {
      setRestaurants([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchRestaurants(search, city, 1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchRestaurants(search, city, nextPage)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center font-bold text-sm">R</div>
            <span className="font-bold text-gray-900">RestroCloud</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">Order Food Online</h1>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-28 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading && page === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UtensilsCrossed size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No restaurants found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search or city</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} available</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurants.map((r) => <RestaurantCard key={r.id} restaurant={r} />)}
            </div>
            {loading && page > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            )}
            {hasMore && !loading && (
              <button
                onClick={handleLoadMore}
                className="w-full mt-6 py-3 border border-gray-200 rounded-2xl text-sm text-gray-600 font-medium hover:bg-gray-100 transition-colors"
              >
                Load More
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
