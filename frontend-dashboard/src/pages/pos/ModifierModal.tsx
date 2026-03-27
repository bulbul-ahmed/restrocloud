// POS Modifier Selection Modal — supports up to 3 levels of nested modifier groups
import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { MenuItem, ModifierGroup, Modifier } from '@/types/menu.types'
import type { CartModifier } from '@/types/pos.types'

interface Props {
  item: MenuItem
  onClose: () => void
  onConfirm: (modifiers: CartModifier[]) => void
}

export function ModifierModal({ item, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    function seed(groups: ModifierGroup[]) {
      groups.forEach((g) => {
        const req = g.modifiers.filter((m) => m.isRequired).map((m) => m.id)
        if (req.length) init[g.id] = req
        g.modifiers.forEach((m) => { if (m.childGroups) seed(m.childGroups) })
      })
    }
    seed(item.modifierGroups ?? [])
    return init
  })

  const groups = item.modifierGroups ?? []

  function toggleModifier(group: ModifierGroup, modId: string) {
    const mod = group.modifiers.find((m) => m.id === modId)
    if (mod?.isRequired) return
    setSelected((prev) => {
      const cur = prev[group.id] ?? []
      if (cur.includes(modId)) return { ...prev, [group.id]: cur.filter((id) => id !== modId) }
      if (group.maxSelect === 1) return { ...prev, [group.id]: [modId] }
      if (cur.length >= group.maxSelect) return prev
      return { ...prev, [group.id]: [...cur, modId] }
    })
  }

  // Collect required groups visible based on current selections
  function collectVisibleRequired(group: ModifierGroup): ModifierGroup[] {
    const result: ModifierGroup[] = group.isRequired ? [group] : []
    group.modifiers.forEach((mod) => {
      if ((selected[group.id] ?? []).includes(mod.id)) {
        mod.childGroups?.forEach((cg) => result.push(...collectVisibleRequired(cg)))
      }
    })
    return result
  }

  function canConfirm(): boolean {
    const allVisible: ModifierGroup[] = []
    groups.forEach((g) => allVisible.push(...collectVisibleRequired(g)))
    return allVisible.every((g) => (selected[g.id] ?? []).length >= g.minSelect)
  }

  // Flatten all modifiers across all group levels for price lookup
  function flattenModifiers(mods: Modifier[]): Modifier[] {
    return mods.flatMap((m) => [m, ...flattenModifiers((m.childGroups ?? []).flatMap((cg) => cg.modifiers))])
  }

  function calcExtra(): number {
    const allMods = flattenModifiers(groups.flatMap((g) => g.modifiers))
    return Object.values(selected).flat().reduce((sum, mId) => {
      const mod = allMods.find((m) => m.id === mId)
      return sum + Number(mod?.priceAdjustment ?? 0)
    }, 0)
  }

  function handleConfirm() {
    const allMods = flattenModifiers(groups.flatMap((g) => g.modifiers))
    const cartModifiers: CartModifier[] = Object.values(selected).flat().map((mId) => {
      const mod = allMods.find((m) => m.id === mId)!
      return {
        modifierId: mId,
        name: mod.name,
        price: Number(mod.priceAdjustment),
      }
    })
    onConfirm(cartModifiers)
  }

  function renderGroup(group: ModifierGroup, depth: number = 0) {
    return (
      <div key={group.id} className={cn('', depth > 0 && 'ml-4 pl-3 border-l-2 border-brand/20 mt-2')}>
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <p className={cn('font-semibold text-gray-800', depth === 0 ? 'text-sm' : 'text-xs')}>{group.name}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={group.isRequired ? 'default' : 'secondary'} className="text-2xs">
              {group.isRequired ? 'Required' : 'Optional'}
            </Badge>
            {group.maxSelect > 1 && (
              <Badge variant="info" className="text-2xs">up to {group.maxSelect}</Badge>
            )}
          </div>
        </div>
        <div className="space-y-1">
          {group.modifiers.filter((m) => m.isAvailable).map((mod) => {
            const isSelected = (selected[group.id] ?? []).includes(mod.id)
            const isRadio = group.maxSelect === 1
            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModifier(group, mod.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors',
                    isSelected
                      ? 'border-brand bg-orange-50'
                      : 'border-border bg-white hover:bg-surface-subtle',
                  )}
                >
                  {mod.isRequired ? (
                    <Lock size={12} className="flex-shrink-0 text-brand" />
                  ) : (
                    <div
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center w-4 h-4 border-2 transition-colors',
                        isRadio ? 'rounded-full' : 'rounded',
                        isSelected ? 'bg-brand border-brand' : 'border-gray-300 bg-white',
                      )}
                    >
                      {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                  )}
                  <span className="flex-1 text-sm text-gray-800">{mod.name}</span>
                  {Number(mod.priceAdjustment) !== 0 && (
                    <span className={cn(
                      'text-xs font-medium',
                      Number(mod.priceAdjustment) > 0 ? 'text-gray-600' : 'text-emerald-600',
                    )}>
                      {Number(mod.priceAdjustment) > 0 ? '+' : ''}
                      {formatCurrency(Number(mod.priceAdjustment))}
                    </span>
                  )}
                  {mod.childGroups && mod.childGroups.length > 0 && (
                    <span className="text-xs text-brand">›</span>
                  )}
                </button>
                {/* Show child groups inline when selected */}
                {isSelected && mod.childGroups && mod.childGroups.length > 0 && (
                  <div className="mt-1">
                    {mod.childGroups.map((cg) => renderGroup(cg, depth + 1))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const extra = calcExtra()
  const total = Number(item.price) + extra

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {item.name}
            <span className="text-brand font-bold ml-2">{formatCurrency(Number(item.price))}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {groups.map((group) => renderGroup(group))}
        </div>

        <DialogFooter className="border-t border-border pt-3 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm()}>
            Add to Cart · {formatCurrency(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
