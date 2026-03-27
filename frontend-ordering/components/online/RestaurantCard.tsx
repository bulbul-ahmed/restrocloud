'use client'
import Link from 'next/link'
import type { OnlineRestaurantSummary } from '../../types/online.types'

interface Props {
  restaurant: OnlineRestaurantSummary
}

export default function RestaurantCard({ restaurant }: Props) {
  const initial = restaurant.name.charAt(0).toUpperCase()

  return (
    <Link href={`/${restaurant.publicSlug}`} className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Hero / logo area */}
      <div className="h-32 bg-brand/10 flex items-center justify-center">
        {restaurant.logoUrl ? (
          <img src={restaurant.logoUrl} alt={restaurant.name} className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-brand text-white flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate">{restaurant.name}</h3>
        {restaurant.city && <p className="text-sm text-gray-500 mt-0.5">{restaurant.city}</p>}

        <div className="flex flex-wrap gap-1.5 mt-3">
          {restaurant.orderTypes.map((t) => (
            <span key={t} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 capitalize">
              {t.toLowerCase().replace('_', ' ')}
            </span>
          ))}
        </div>

        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          {restaurant.deliveryFee !== null && restaurant.deliveryFee !== undefined && (
            <span>৳{Number(restaurant.deliveryFee)} delivery</span>
          )}
          {restaurant.minimumOrderAmount !== null && restaurant.minimumOrderAmount !== undefined && (
            <span>Min ৳{Number(restaurant.minimumOrderAmount)}</span>
          )}
          {restaurant.estimatedDeliveryMin && (
            <span>{restaurant.estimatedDeliveryMin} min</span>
          )}
        </div>
      </div>
    </Link>
  )
}
