// M25.5 — Order history with one-tap reorder
import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ordersApi } from '../../src/lib/orders.api'
import { useAuthStore } from '../../src/store/auth.store'
import { useCartStore } from '../../src/store/cart.store'
import { OrderCard } from '../../src/components/OrderCard'
import { COLORS } from '../../src/constants/colors'

export default function OrdersScreen() {
  const router = useRouter()
  const { accessToken, setCartToken } = useAuthStore()
  const { setCart } = useCartStore()
  const [page] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['order-history', page],
    queryFn: () => ordersApi.getHistory(page),
    enabled: !!accessToken,
    staleTime: 30_000,
  })

  const reorderMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.reorder(orderId),
    onSuccess: ({ cartToken }) => {
      setCartToken(cartToken)
      router.push('/(tabs)/cart')
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Could not reorder.')
    },
  })

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>Sign in to see your orders</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const orders = data?.orders ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <View>
            <OrderCard
              order={item}
              onPress={() => router.push(`/order/${item.id}` as any)}
            />
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={() => reorderMutation.mutate(item.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.reorderText}>🔄 Reorder</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>Your order history will appear here</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16, paddingBottom: 24 },
  reorderBtn: {
    marginTop: -4,
    marginBottom: 14,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.brandLight,
  },
  reorderText: { fontSize: 12, fontWeight: '700', color: COLORS.brand },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },
  signInBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 20,
  },
  signInBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
})
