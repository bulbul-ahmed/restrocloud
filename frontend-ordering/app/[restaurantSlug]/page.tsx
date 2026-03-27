import type { Metadata } from 'next'
import type { OnlineRestaurant } from '../../types/online.types'
import OnlineShell from '../../components/online/OnlineShell'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

async function fetchRestaurant(slug: string): Promise<OnlineRestaurant | null> {
  try {
    const res = await fetch(`${API_URL}/online/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data as any)?.data ?? data
  } catch {
    return null
  }
}

interface Props {
  params: Promise<{ restaurantSlug: string }>
}

export default async function RestaurantPage({ params }: Props) {
  const { restaurantSlug } = await params
  const restaurant = await fetchRestaurant(restaurantSlug)

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">Restaurant not found</p>
          <p className="text-gray-400 text-sm font-mono bg-gray-100 px-3 py-1 rounded">{restaurantSlug}</p>
        </div>
      </div>
    )
  }

  const brandRgb = restaurant.brandColor
    ? restaurant.brandColor.replace('#', '').match(/.{2}/g)?.map((h) => parseInt(h, 16)).join(' ')
    : '255 107 53'

  return (
    <>
      <style>{`:root { --brand-rgb: ${brandRgb}; }`}</style>
      <OnlineShell slug={restaurantSlug} initialRestaurant={restaurant} />
    </>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params
  const restaurant = await fetchRestaurant(restaurantSlug)
  if (!restaurant) return { title: `${restaurantSlug} | RestroCloud` }
  return {
    title: `${restaurant.name} | Order Online`,
    description: restaurant.description ?? `Order from ${restaurant.name} online`,
  }
}
