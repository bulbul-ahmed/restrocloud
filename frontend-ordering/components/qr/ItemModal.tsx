'use client'
import { useState, useEffect } from 'react'
import { X, Minus, Plus, Check, Lock } from 'lucide-react'
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

export function ItemModal({ item, currency, onClose, onAdd }: Props) {
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
  // visible: controls enter slide-up; added: controls exit slide-down
  const [visible, setVisible] = useState(false)
  const [added, setAdded] = useState(false)

  const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price

  // Trigger enter animation after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onClose, 200)
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

  // Collect all required groups that are currently "visible" (parent modifier selected)
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
    return allVisible.every((g) => (selected[g.id] ?? []).length >= g.minSelections)
  }

  // Flatten all modifiers across all group levels
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
    // Fire API in background — QrShell handles errors via toast
    onAdd(item.id, qty, modifiers, notes).catch(() => {})
    // Slide sheet down immediately — don't wait for network
    setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 180)
    }, 120)
  }

  const groups = item.modifierGroups ?? []

  function renderGroup(group: ModifierGroup, depth: number = 0) {
    return (
      <div
        className={cn('mt-4', depth > 0 && 'ml-4 border-l-2 border-brand/20 pl-3')}
      >
        <div className="flex items-center justify-between mb-1">
          <p className={cn('font-semibold text-gray-800', depth === 0 ? 'text-sm' : 'text-xs')}>{group.name}</p>
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              group.isRequired ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500',
            )}
          >
            {group.isRequired ? 'Required' : 'Optional'}
            {group.maxSelections > 1 ? ` · up to ${group.maxSelections}` : ''}
          </span>
        </div>
        <div className="space-y-2">
          {(group.modifiers ?? []).map((mod, mi) => {
            const isSelected = (selected[group.id] ?? []).includes(mod.id)
            const isRadio = group.maxSelections === 1
            return (
              <div key={mod.id ?? `mod-${mi}`}>
                <button
                  disabled={!mod.isAvailable}
                  onClick={() => toggleModifier(group, mod.id)}
                  style={mod.isRequired ? { cursor: 'default' } : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                    isSelected ? 'border-brand bg-brand/10' : 'border-gray-200 bg-white',
                    !mod.isAvailable && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {mod.isRequired ? (
                    <Lock size={10} className="flex-shrink-0 text-brand" />
                  ) : (
                    <div
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center border-2 transition-colors',
                        isRadio ? 'w-4 h-4 rounded-full' : 'w-4 h-4 rounded',
                        isSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                      )}
                    >
                      {isSelected && (
                        <div className={cn('bg-white', isRadio ? 'w-1.5 h-1.5 rounded-full' : 'w-2 h-2 rounded-sm')} />
                      )}
                    </div>
                  )}
                  <span className={cn('flex-1 text-sm text-left', !mod.isAvailable && 'line-through text-gray-400')}>
                    {mod.name}
                  </span>
                  {mod.priceAdjustment !== 0 && (
                    <span className="text-xs text-gray-500 font-medium">
                      {mod.priceAdjustment > 0 ? '+' : ''}
                      {fmtPrice(mod.priceAdjustment, currency)}
                    </span>
                  )}
                  {mod.childGroups && mod.childGroups.length > 0 && (
                    <span className="text-xs text-brand font-medium">›</span>
                  )}
                </button>
                {/* Inline child groups when this modifier is selected */}
                {isSelected && mod.childGroups && mod.childGroups.length > 0 && (
                  <div>
                    {mod.childGroups.map((cg, ci) => <div key={cg.id ?? `cg-${ci}`}>{renderGroup(cg, depth + 1)}</div>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={added ? undefined : dismiss}>
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative mt-auto bg-white rounded-t-3xl max-h-[90vh] flex flex-col',
          'transition-transform duration-200 ease-out will-change-transform',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <X size={16} className="text-gray-600" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 pb-4">
          {/* Product image / fallback */}
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover" />
          ) : (
            <div className={cn('w-full h-48 bg-gradient-to-br flex items-center justify-center', itemGradient(item.name))}>
              <span className="text-white font-bold text-7xl drop-shadow-sm select-none">
                {item.name[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}
          <div className="px-4">
          <h2 className="text-xl font-bold text-gray-900 mt-2 pr-8">{item.name}</h2>
          {item.description && (
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.description}</p>
          )}
          <p className="text-brand font-bold text-lg mt-1">{fmtPrice(price, currency)}</p>

          {/* Modifier groups (recursive) */}
          {groups.map((group, gi) => <div key={group.id ?? `group-${gi}`}>{renderGroup(group)}</div>)}

          {/* Special instructions */}
          <div className="mt-5">
            <p className="font-semibold text-gray-800 text-sm mb-2">Special Instructions</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. no onions, extra sauce…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          </div>{/* /px-4 */}
        </div>

        {/* Footer */}
        <div className="px-4 pb-safe pt-3 border-t border-gray-100 bg-white">
          {/* Quantity */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={added}
              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Minus size={16} className="text-gray-600" />
            </button>
            <span className="text-xl font-bold text-gray-900 w-8 text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              disabled={added}
              className="w-9 h-9 rounded-full border-2 border-brand flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus size={16} className="text-brand" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!canAdd() || added}
            className={cn(
              'w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2',
              'transition-all duration-150 active:scale-[0.97]',
              added
                ? 'bg-green-500 scale-[0.98]'
                : canAdd()
                  ? 'bg-brand'
                  : 'bg-brand opacity-50 cursor-not-allowed',
            )}
          >
            {added ? (
              <>
                <Check size={16} strokeWidth={3} />
                Added!
              </>
            ) : (
              `Add to Cart · ${fmtPrice(calcTotal(), currency)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
