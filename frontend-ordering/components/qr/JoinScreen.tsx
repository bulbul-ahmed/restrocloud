'use client'
import { useState } from 'react'
import type { QrRestaurant, QrTable } from '../../types/qr.types'

interface Props {
  restaurant: QrRestaurant
  table: QrTable
  onJoin: (name: string) => void  // empty string = joined as guest
}

export function JoinScreen({ restaurant, table, onJoin }: Props) {
  const [name, setName] = useState('')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        {(restaurant.logoWordmarkUrl ?? restaurant.logoUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(restaurant.logoWordmarkUrl ?? restaurant.logoUrl)!}
            alt={restaurant.name}
            className="h-14 max-w-[220px] rounded-xl object-contain shadow mx-auto mb-3"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-brand text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3 shadow">
            {restaurant.name[0]}
          </div>
        )}
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </div>

      {/* Join card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <p className="text-gray-500 text-sm text-center mb-1">You are joining</p>
        <p className="text-2xl font-bold text-gray-900 text-center mb-6">
          Table {table.tableNumber}
          {table.floorSection ? <span className="text-base font-normal text-gray-400 ml-2">· {table.floorSection.name}</span> : null}
        </p>

        <p className="text-sm font-semibold text-gray-700 mb-2">Who are you?</p>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onJoin(name.trim()) }}
          maxLength={40}
          autoFocus
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
        />

        {/* Continue — only shows when name is typed */}
        {name.trim().length > 0 && (
          <button
            onClick={() => onJoin(name.trim())}
            className="mt-4 w-full bg-brand text-white font-semibold py-3.5 rounded-2xl text-sm transition-opacity"
          >
            Continue as {name.trim()}
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Join as Guest */}
        <button
          onClick={() => onJoin('')}
          className="w-full border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl text-sm hover:bg-gray-50 transition-colors"
        >
          Join as Guest
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center max-w-xs">
        Your name helps the table know who ordered what. You can change it anytime.
      </p>
    </div>
  )
}
