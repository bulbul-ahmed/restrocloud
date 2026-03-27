'use client'
import type { OnlineRestaurant } from '../../types/online.types'

interface Props {
  restaurant: OnlineRestaurant
  minimal?: boolean
}

export default function RestaurantHero({ restaurant, minimal }: Props) {
  const initial = restaurant.name.charAt(0).toUpperCase()

  if (minimal) {
    return (
      <div className="flex items-center gap-3 px-4 h-14">
        {restaurant.logoUrl ? (
          <img src={restaurant.logoUrl} alt={restaurant.name} className="h-8 w-8 rounded-lg object-contain bg-gray-50" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
            {initial}
          </div>
        )}
        <span className="font-semibold text-gray-900 text-sm truncate">{restaurant.name}</span>
        {restaurant.isOpen === false && (
          <span className="ml-auto shrink-0 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
        )}
      </div>
    )
  }

  const heroLogo = restaurant.logoWordmarkUrl ?? restaurant.logoUrl

  return (
    <div className="bg-gradient-to-br from-brand/10 to-white px-4 pt-6 pb-5">
      <div className="flex gap-4 items-start">
        {heroLogo ? (
          <img src={heroLogo} alt={restaurant.name} className="h-14 max-w-[180px] rounded-xl object-contain bg-white/70 shrink-0 shadow px-1" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-brand text-white flex items-center justify-center text-2xl font-bold shrink-0 shadow">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
            {restaurant.isOpen === false ? (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Closed</span>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>
            )}
          </div>
          {restaurant.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{restaurant.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            {restaurant.city && <span>{restaurant.city}</span>}
            {restaurant.deliveryFee !== null && restaurant.deliveryFee !== undefined && (
              <span>Delivery ৳{Number(restaurant.deliveryFee)}</span>
            )}
            {restaurant.minimumOrderAmount !== null && restaurant.minimumOrderAmount !== undefined && (
              <span>Min ৳{Number(restaurant.minimumOrderAmount)}</span>
            )}
            {restaurant.estimatedDeliveryMin && (
              <span>~{restaurant.estimatedDeliveryMin} min</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
