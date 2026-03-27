// M25.2 — Item customization: modifier selection (up to 3 nested levels)
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { menuApi } from '../../src/lib/menu.api'
import { cartApi } from '../../src/lib/cart.api'
import { useAuthStore } from '../../src/store/auth.store'
import { useCartStore } from '../../src/store/cart.store'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { COLORS } from '../../src/constants/colors'
import type { ModifierGroup, Modifier } from '../../src/types/menu.types'

export default function ItemScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>()
  const router = useRouter()
  const { cartToken, setCartToken } = useAuthStore()
  const { restaurantId, setCart } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({})

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => menuApi.getItem(itemId!),
    enabled: !!itemId,
  })

  // Seed required modifiers as pre-selected when item loads
  useEffect(() => {
    if (!item) return
    const init: Record<string, string[]> = {}
    function seed(groups: ModifierGroup[]) {
      groups.forEach((g) => {
        const req = g.modifiers.filter((m) => m.isRequired).map((m) => m.id)
        if (req.length) init[g.id] = req
        g.modifiers.forEach((m) => { if (m.childGroups) seed(m.childGroups) })
      })
    }
    seed(item.modifierGroups ?? [])
    if (Object.keys(init).length) setSelectedModifiers(init)
  }, [item?.id])

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !item) throw new Error('Missing data')

      let token = cartToken
      if (!token) {
        const res = await cartApi.init(restaurantId)
        token = res.cartToken
        setCartToken(token)
      }

      const modifiers = Object.values(selectedModifiers)
        .flat()
        .map((modifierId) => {
          const group = item.modifierGroups?.find((g) =>
            g.modifiers.some((m) => m.id === modifierId),
          )
          return { modifierId, modifierGroupId: group?.id ?? '' }
        })

      return cartApi.addItem(restaurantId, token, {
        itemId: item.id,
        quantity,
        modifiers,
      })
    },
    onSuccess: (cart) => {
      setCart(cart)
      router.back()
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Could not add item.')
    },
  })

  function toggleModifier(group: ModifierGroup, modifierId: string) {
    const mod = group.modifiers.find((m) => m.id === modifierId)
    if (mod?.isRequired) return
    setSelectedModifiers((prev) => {
      const current = prev[group.id] ?? []
      if (current.includes(modifierId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifierId) }
      }
      if (current.length >= group.maxSelections) {
        if (group.maxSelections === 1) {
          return { ...prev, [group.id]: [modifierId] }
        }
        return prev
      }
      return { ...prev, [group.id]: [...current, modifierId] }
    })
  }

  // Collect required groups visible given current selections (nested)
  function collectVisibleRequired(group: ModifierGroup): ModifierGroup[] {
    const result: ModifierGroup[] = group.isRequired ? [group] : []
    group.modifiers.forEach((mod) => {
      if ((selectedModifiers[group.id] ?? []).includes(mod.id)) {
        mod.childGroups?.forEach((cg) => result.push(...collectVisibleRequired(cg)))
      }
    })
    return result
  }

  function canAddToCart(): boolean {
    if (!item?.modifierGroups) return true
    const allVisible: ModifierGroup[] = []
    item.modifierGroups.forEach((g) => allVisible.push(...collectVisibleRequired(g)))
    return allVisible.every((g) => (selectedModifiers[g.id] ?? []).length >= g.minSelections)
  }

  // Flatten all modifiers from all levels for price calc
  function flattenModifiers(mods: Modifier[]): Modifier[] {
    return mods.flatMap((m) => [m, ...flattenModifiers((m.childGroups ?? []).flatMap((cg) => cg.modifiers))])
  }

  function calculateTotal(): number {
    if (!item) return 0
    const allMods = flattenModifiers((item.modifierGroups ?? []).flatMap((g) => g.modifiers))
    const modsTotal = Object.values(selectedModifiers)
      .flat()
      .reduce((sum, modId) => {
        const mod = allMods.find((m) => m.id === modId)
        return sum + (mod?.priceAdjustment ?? 0)
      }, 0)
    return (parseFloat(item.price) + modsTotal) * quantity
  }

  if (isLoading || !item) return <LoadingScreen />

  function renderGroup(group: ModifierGroup, depth: number = 0) {
    return (
      <View
        key={group.id}
        style={[styles.group, depth > 0 && { marginLeft: 16, borderLeftWidth: 2, borderLeftColor: COLORS.brand + '33', paddingLeft: 10 }]}
      >
        <View style={styles.groupHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.groupName, depth > 0 && { fontSize: 13 }]}>{group.name}</Text>
          </View>
          <Text style={styles.groupHint}>
            {group.isRequired ? 'Required' : 'Optional'}
            {group.maxSelections > 1 ? ` • up to ${group.maxSelections}` : ''}
          </Text>
        </View>
        {group.modifiers.map((mod) => {
          const isSelected = (selectedModifiers[group.id] ?? []).includes(mod.id)
          return (
            <View key={mod.id}>
              <TouchableOpacity
                style={[styles.modRow, isSelected && styles.modRowSelected]}
                onPress={() => toggleModifier(group, mod.id)}
                activeOpacity={mod.isRequired ? 1 : 0.75}
                disabled={!mod.isAvailable || mod.isRequired}
              >
                {mod.isRequired ? (
                  <Text style={{ fontSize: 14, width: 22, textAlign: 'center' }}>🔒</Text>
                ) : (
                  <View style={[styles.modCheck, isSelected && styles.modCheckSelected]}>
                    {isSelected && <Text style={styles.modCheckMark}>✓</Text>}
                  </View>
                )}
                <Text style={[styles.modName, !mod.isAvailable && styles.modUnavail]}>
                  {mod.name}
                </Text>
                {mod.priceAdjustment !== 0 && (
                  <Text style={styles.modPrice}>
                    {mod.priceAdjustment > 0 ? '+' : ''}${mod.priceAdjustment.toFixed(2)}
                  </Text>
                )}
                {mod.childGroups && mod.childGroups.length > 0 && (
                  <Text style={{ fontSize: 12, color: COLORS.brand, marginLeft: 4 }}>›</Text>
                )}
              </TouchableOpacity>
              {/* Inline child groups when this modifier is selected */}
              {isSelected && mod.childGroups && mod.childGroups.map((cg) => renderGroup(cg, depth + 1))}
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Item info */}
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.itemDesc}>{item.description}</Text>
          )}
          <Text style={styles.basePrice}>from ${parseFloat(item.price).toFixed(2)}</Text>
        </View>

        {/* Modifier groups (recursive) */}
        {(item.modifierGroups ?? []).map((group) => renderGroup(group))}

        {/* Quantity */}
        <View style={styles.qtySection}>
          <Text style={styles.qtyLabel}>Quantity</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => q + 1)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Add to cart */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, (!canAddToCart() || addMutation.isPending) && styles.addBtnDisabled]}
          onPress={() => addMutation.mutate()}
          disabled={!canAddToCart() || addMutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>
            {addMutation.isPending ? 'Adding…' : `Add to Cart • $${calculateTotal().toFixed(2)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 24 },
  itemHeader: { marginBottom: 24 },
  itemName: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  itemDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20, marginBottom: 8 },
  basePrice: { fontSize: 16, fontWeight: '700', color: COLORS.brand },
  group: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  groupHint: { fontSize: 12, color: COLORS.muted, fontWeight: '500' },
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: COLORS.surface,
  },
  modRowSelected: { backgroundColor: COLORS.brandLight, borderWidth: 1.5, borderColor: COLORS.brand },
  modCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modCheckSelected: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  modCheckMark: { fontSize: 12, color: COLORS.white, fontWeight: '800' },
  modName: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  modUnavail: { color: COLORS.muted, textDecorationLine: 'line-through' },
  modPrice: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
  qtySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  qtyLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 20, color: COLORS.text, fontWeight: '600', lineHeight: 24 },
  qtyValue: { fontSize: 18, fontWeight: '700', color: COLORS.text, minWidth: 28, textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  addBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
})
