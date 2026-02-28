// M23.6 — Quick menu toggle (mark items in/out of stock)
import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Switch,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../src/store/auth.store'
import { menuApi } from '../../src/lib/menu.api'
import { COLORS } from '../../src/constants/colors'
import type { MenuItem } from '../../src/types/menu.types'

export default function MenuScreen() {
  const user = useAuthStore((s) => s.user)
  const rid = user?.restaurantId ?? ''
  const queryClient = useQueryClient()
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['menu-items', rid],
    queryFn: () => menuApi.listItems(rid),
    enabled: !!rid,
    staleTime: 60_000,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      menuApi.toggleAvailability(rid, itemId, isAvailable),
    onMutate: async ({ itemId, isAvailable }) => {
      setToggling((s) => new Set(s).add(itemId))
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['menu-items', rid] })
      const prev = queryClient.getQueryData<MenuItem[]>(['menu-items', rid])
      queryClient.setQueryData<MenuItem[]>(['menu-items', rid], (old) =>
        (old ?? []).map((i) => (i.id === itemId ? { ...i, isAvailable } : i)),
      )
      return { prev }
    },
    onError: (_err, { itemId }, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['menu-items', rid], ctx.prev)
      setToggling((s) => {
        const next = new Set(s)
        next.delete(itemId)
        return next
      })
      Alert.alert('Error', 'Failed to update item availability.')
    },
    onSettled: (_data, _err, { itemId }) => {
      setToggling((s) => {
        const next = new Set(s)
        next.delete(itemId)
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['menu-items', rid] })
    },
  })

  const items: MenuItem[] = Array.isArray(data) ? data : []

  // Group by category
  const grouped: Record<string, MenuItem[]> = {}
  for (const item of items) {
    const cat = item.category?.name ?? 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  type Section = { category: string; items: MenuItem[] }
  const sections: Section[] = Object.entries(grouped).map(([category, items]) => ({
    category,
    items,
  }))

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={sections}
        keyExtractor={(s) => s.category}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.category}</Text>
            {section.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemName, !item.isAvailable && styles.unavailable]}>
                    {item.name}
                  </Text>
                  <Text style={styles.price}>৳{parseFloat(item.basePrice).toFixed(2)}</Text>
                </View>
                <View style={styles.switchWrap}>
                  {!item.isAvailable && (
                    <Text style={styles.outTag}>OUT</Text>
                  )}
                  <Switch
                    value={item.isAvailable}
                    onValueChange={(val) => toggleMutation.mutate({ itemId: item.id, isAvailable: val })}
                    disabled={toggling.has(item.id)}
                    trackColor={{ false: COLORS.border, true: COLORS.brand }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No menu items found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  unavailable: { color: COLORS.muted, textDecorationLine: 'line-through' },
  price: { fontSize: 13, color: COLORS.muted },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.danger,
    backgroundColor: COLORS.danger + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: COLORS.muted },
})
