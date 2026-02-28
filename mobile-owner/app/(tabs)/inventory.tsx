// M23.5 — Low Stock Alerts
import React from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../src/store/auth.store'
import { inventoryApi } from '../../src/lib/inventory.api'
import { COLORS } from '../../src/constants/colors'
import type { Ingredient } from '../../src/types/inventory.types'

export default function InventoryScreen() {
  const user = useAuthStore((s) => s.user)
  const rid = user?.restaurantId ?? ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', rid, 'low-stock'],
    queryFn: () => inventoryApi.listIngredients(rid, true),
    enabled: !!rid,
    staleTime: 120_000,
    refetchInterval: 300_000,
  })

  const items: Ingredient[] = Array.isArray(data) ? data : []

  function renderItem({ item }: { item: Ingredient }) {
    const pct = item.lowStockThreshold > 0 ? item.currentStock / item.lowStockThreshold : 1
    const urgent = pct <= 0.5

    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.name}>{item.name}</Text>
          {item.category ? <Text style={styles.category}>{item.category}</Text> : null}
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.stock, urgent ? styles.stockUrgent : styles.stockWarn]}>
            {item.currentStock} {item.unit}
          </Text>
          <Text style={styles.threshold}>min {item.lowStockThreshold} {item.unit}</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {items.length === 0 && !isLoading ? (
        <View style={styles.allGood}>
          <Text style={styles.allGoodIcon}>✅</Text>
          <Text style={styles.allGoodTitle}>All stock levels are healthy</Text>
          <Text style={styles.allGoodSub}>No ingredients below their minimum threshold</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerText}>
                {items.length} ingredient{items.length !== 1 ? 's' : ''} below threshold
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 40 },
  header: {
    backgroundColor: COLORS.warning + '22',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
  },
  headerText: { color: COLORS.warning, fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  category: { fontSize: 12, color: COLORS.muted },
  stock: { fontSize: 18, fontWeight: '700' },
  stockUrgent: { color: COLORS.danger },
  stockWarn: { color: COLORS.warning },
  threshold: { fontSize: 11, color: COLORS.muted },
  sep: { height: 8 },
  allGood: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  allGoodIcon: { fontSize: 48 },
  allGoodTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  allGoodSub: { fontSize: 13, color: COLORS.muted, textAlign: 'center', paddingHorizontal: 32 },
})
