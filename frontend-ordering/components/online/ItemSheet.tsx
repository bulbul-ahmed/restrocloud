'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, Minus, Plus, Check } from 'lucide-react'
import { cn, fmtPrice } from '../../lib/utils'
import type { MenuItem, ModifierGroup, ModifierOption } from '../../types/qr.types'

const GRADIENTS = [
  'from-orange-400 to-amber-300',
  'from-red-400 to-rose-300',
  'from-emerald-400 to-teal-300',
  'from-blue-400 to-cyan-300',
  'from-purple-400 to-violet-300',
  'from-pink-400 to-fuchsia-300',
  'from-yellow-400 to-orange-300',
  'from-green-400 to-emerald-300',
]
function itemGradient(name: string): string {
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[sum % GRADIENTS.length]
}

interface Props {
  item: MenuItem
  currency: string
  onClose: () => void
  onAdd: (itemId: string, quantity: number, modifiers: { modifierId: string }[], notes: string) => Promise<void>
}

export function ItemSheet({ item, currency, onClose, onAdd }: Props) {
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    function seed(groups: ModifierGroup[]) {
      groups.forEach((g) => {
        const mods = g.modifiers ?? []
        const req = mods.filter((m) => m.isRequired).map((m) => m.id)
        if (req.length) init[g.id] = req
        mods.forEach((m) => { if (m.childGroups) seed(m.childGroups) })
      })
    }
    seed(item.modifierGroups ?? [])
    return init
  })
  const [notes, setNotes] = useState('')
  const [visible, setVisible] = useState(false)
  const [added, setAdded] = useState(false)

  const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  function toggleModifier(group: ModifierGroup, modId: string) {
    const mod = (group.modifiers ?? []).find((m) => m.id === modId)
    if (mod?.isRequired) return
    setSelected((prev) => {
      const cur = prev[group.id] ?? []
      if (cur.includes(modId)) return { ...prev, [group.id]: cur.filter((id) => id !== modId) }
      if (group.maxSelections === 1) return { ...prev, [group.id]: [modId] }
      if (cur.length >= group.maxSelections) return prev
      return { ...prev, [group.id]: [...cur, modId] }
    })
  }

  function collectVisibleRequired(group: ModifierGroup): ModifierGroup[] {
    const result: ModifierGroup[] = group.isRequired ? [group] : []
    ;(group.modifiers ?? []).forEach((mod) => {
      if ((selected[group.id] ?? []).includes(mod.id)) {
        mod.childGroups?.forEach((cg) => result.push(...collectVisibleRequired(cg)))
      }
    })
    return result
  }

  function canAdd(): boolean {
    if (!item.modifierGroups) return true
    const allVisible: ModifierGroup[] = []
    item.modifierGroups.forEach((g) => allVisible.push(...collectVisibleRequired(g)))
    return allVisible.every((g) => {
      const min = g.isRequired ? Math.max(g.minSelections ?? 0, 1) : (g.minSelections ?? 0)
      return (selected[g.id] ?? []).length >= min
    })
  }

  function flattenModifiers(groups: ModifierGroup[]): ModifierOption[] {
    return groups.flatMap((g) => {
      const mods = g.modifiers ?? []
      return [...mods, ...flattenModifiers(mods.flatMap((m) => m.childGroups ?? []))]
    })
  }

  function calcTotal(): number {
    const allMods = flattenModifiers(item.modifierGroups ?? [])
    const modAdj = Object.values(selected).flat().reduce((sum, mId) => {
      const mod = allMods.find((m) => m.id === mId)
      return sum + Number(mod?.priceAdjustment ?? 0)
    }, 0)
    return (price + modAdj) * qty
  }

  function handleAdd() {
    if (added || !canAdd()) return
    setAdded(true)
    const modifiers = Object.values(selected).flat().map((modifierId) => ({ modifierId }))
    onAdd(item.id, qty, modifiers, notes).catch(() => {})
    setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200)
    }, 400)
  }

  function renderGroup(group: ModifierGroup, depth = 0) {
    const groupSelected = selected[group.id] ?? []
    const needsSelection = group.isRequired && groupSelected.length === 0
    return (
      <div className={cn('mt-4', depth > 0 && 'ml-4 border-l-2 border-brand/20 pl-3')}>
        <div className="flex items-center justify-between mb-2">
          <p className={cn('font-semibold text-gray-800', depth === 0 ? 'text-sm' : 'text-xs')}>{group.name}</p>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            group.isRequired
              ? needsSelection ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-600'
              : 'bg-gray-100 text-gray-500',
          )}>
            {group.isRequired ? (needsSelection ? 'Required' : 'Done ✓') : 'Optional'}
            {group.maxSelections > 1 ? ` · up to ${group.maxSelections}` : ''}
          </span>
        </div>
        <div className="space-y-2">
          {(group.modifiers ?? []).map((mod, mi) => {
            const isSelected = groupSelected.includes(mod.id)
            return (
              <div key={mod.id ?? `mod-${mi}`}>
                <button
                  disabled={!mod.isAvailable}
                  onClick={() => toggleModifier(group, mod.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                    isSelected ? 'border-brand bg-brand/5' : 'border-gray-200 bg-white',
                    !mod.isAvailable && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {/* Circle indicator — filled when selected */}
                  <div className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                  )}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={cn('flex-1 text-sm text-left font-medium', !mod.isAvailable && 'line-through text-gray-400', isSelected ? 'text-gray-900' : 'text-gray-600')}>
                    {mod.name}
                  </span>
                  {Number(mod.priceAdjustment) !== 0 && (
                    <span className="text-xs text-gray-500 font-medium">
                      {Number(mod.priceAdjustment) > 0 ? '+' : ''}{fmtPrice(Number(mod.priceAdjustment), currency)}
                    </span>
                  )}
                  {mod.childGroups && mod.childGroups.length > 0 && (
                    <span className="text-xs text-brand font-medium">›</span>
                  )}
                </button>
                {isSelected && mod.childGroups && mod.childGroups.length > 0 && (
                  <div>
                    {mod.childGroups.map((cg, ci) => (
                      <div key={cg.id ?? `cg-${ci}`}>{renderGroup(cg, depth + 1)}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const groups = item.modifierGroups ?? []

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={added ? undefined : dismiss}>
      {/* Backdrop */}
      <div className={cn(
        'absolute inset-0 bg-black/50 transition-opacity duration-250',
        visible ? 'opacity-100' : 'opacity-0',
      )} />

      {/* Side sheet */}
      <div
        className={cn(
          'relative w-[88vw] max-w-sm h-full bg-white flex flex-col shadow-2xl',
          'transition-transform duration-250 ease-out will-change-transform',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 shrink-0">
          <button
            onClick={dismiss}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h2 className="font-bold text-gray-900 text-base truncate flex-1">{item.name}</h2>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Product image */}
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full aspect-[4/3] object-cover"
            />
          ) : (
            <div className={cn('w-full aspect-[4/3] bg-gradient-to-br flex items-center justify-center', itemGradient(item.name))}>
              <span className="text-white font-bold text-8xl drop-shadow-sm select-none">
                {item.name[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}

          <div className="px-4 py-4 space-y-1">
            <h3 className="text-xl font-bold text-gray-900">{item.name}</h3>
            <p className="text-2xl font-bold text-brand">{fmtPrice(price, currency)}</p>
            {item.description && (
              <p className="text-sm text-gray-500 leading-relaxed pt-1">{item.description}</p>
            )}

            {/* Tags */}
            {(item.dietaryTags?.length || item.allergens?.length) ? (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {item.dietaryTags?.map((tag) => (
                  <span key={tag} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                    {tag}
                  </span>
                ))}
                {item.allergens?.map((a) => (
                  <span key={a} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                    ⚠ {a}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Modifier groups */}
          {groups.length > 0 && (
            <div className="px-4 pb-4">
              <div className="h-px bg-gray-100 mb-1" />
              {groups.map((group, gi) => (
                <div key={group.id ?? `group-${gi}`}>{renderGroup(group)}</div>
              ))}
            </div>
          )}

          {/* Special instructions */}
          <div className="px-4 pb-6">
            {groups.length > 0 && <div className="h-px bg-gray-100 mb-4" />}
            <p className="font-semibold text-gray-800 text-sm mb-2">Special Instructions</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. no onions, extra sauce…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-6 border-t border-gray-100 bg-white shrink-0">
          {/* Quantity selector */}
          <div className="flex items-center justify-center gap-5 mb-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={added}
              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Minus size={15} className="text-gray-600" />
            </button>
            <span className="text-xl font-bold text-gray-900 w-6 text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              disabled={added}
              className="w-9 h-9 rounded-full border-2 border-brand flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus size={15} className="text-brand" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd() || added}
            className={cn(
              'w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2',
              'transition-all duration-150 active:scale-[0.97]',
              added
                ? 'bg-green-500'
                : canAdd()
                  ? 'bg-brand'
                  : 'bg-brand opacity-50 cursor-not-allowed',
            )}
          >
            {added ? (
              <><Check size={16} strokeWidth={3} /> Added to cart!</>
            ) : (
              `Add to Cart · ${fmtPrice(calcTotal(), currency)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
