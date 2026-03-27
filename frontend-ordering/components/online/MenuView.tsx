'use client'
import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { ItemCard } from '../qr/ItemCard'
import type { MenuCategory, MenuItem } from '../../types/qr.types'

interface Props {
  categories: MenuCategory[]
  currency: string
  searchQuery: string
  onSearchChange: (q: string) => void
  activeCategory: string | null
  onCategoryChange: (id: string) => void
  onItemSelect: (item: MenuItem) => void
  categoryRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}

export default function MenuView({
  categories,
  currency,
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onItemSelect,
  categoryRefs,
}: Props) {
  const tabsRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view
  useEffect(() => {
    if (!activeCategory || !tabsRef.current) return
    const el = tabsRef.current.querySelector(`[data-cat="${activeCategory}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [activeCategory])

  // Flat search results
  const searchResults: { item: MenuItem; categoryName: string }[] = []
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    for (const cat of categories) {
      for (const item of cat.items) {
        if (item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)) {
          searchResults.push({ item, categoryName: cat.name })
        }
      }
    }
  }

  return (
    <div>
      {/* Sticky category tabs */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-100 shadow-sm">
        {/* Search bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        {/* Category tabs */}
        {!searchQuery && (
          <div ref={tabsRef} className="flex gap-1 overflow-x-auto scrollbar-hide px-4 pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                data-cat={cat.id}
                onClick={() => {
                  onCategoryChange(cat.id)
                  const el = categoryRefs.current[cat.id]
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 110
                    window.scrollTo({ top: y, behavior: 'smooth' })
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-32">
        {/* Search results */}
        {searchQuery ? (
          <div className="mt-4">
            {searchResults.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No items found for &ldquo;{searchQuery}&rdquo;</p>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResults.map(({ item }) => (
                    <ItemCard key={item.id} item={item} currency={currency} onPress={() => onItemSelect(item)} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Category sections */
          categories.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => { categoryRefs.current[cat.id] = el }}
              style={{ scrollMarginTop: '110px' }}
              className="mt-6"
            >
              <h2 className="text-base font-bold text-gray-900 mb-3">{cat.name}</h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-gray-400">No items in this category</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cat.items.map((item) => (
                    <ItemCard key={item.id} item={item} currency={currency} onPress={() => onItemSelect(item)} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
