// M23.4 — Orders: list with filter tabs + accept/reject
import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { ordersApi } from '../../src/lib/orders.api'
import { OrderCard } from '../../src/components/OrderCard'
import { COLORS } from '../../src/constants/colors'
import type { OrderStatus } from '../../src/types/orders.types'

type Filter = 'ALL' | 'PENDING' | 'PREPARING' | 'READY'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
]

export default function OrdersScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const rid = user?.restaurantId ?? ''
  const [filter, setFilter] = useState<Filter>('PENDING')

  const status = filter === 'ALL' ? undefined : (filter as OrderStatus)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', rid, filter],
    queryFn: () => ordersApi.list(rid, { status, limit: 50 }),
    enabled: !!rid,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const orders = data?.orders ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Filter chips */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => router.push(`/orders/${item.id}` as any)} />
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No orders</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  filters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  chipText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  list: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: COLORS.muted },
})
