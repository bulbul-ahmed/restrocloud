// M25.2 — Menu browsing with categories, item cards, add to cart
import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { menuApi } from '../../src/lib/menu.api'
import { cartApi } from '../../src/lib/cart.api'
import { useAuthStore } from '../../src/store/auth.store'
import { useCartStore } from '../../src/store/cart.store'
import { MenuItemCard } from '../../src/components/MenuItemCard'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { COLORS } from '../../src/constants/colors'
import { CONFIG } from '../../src/constants/config'
import type { MenuCategory, MenuItem } from '../../src/types/menu.types'

export default function MenuScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const { cartToken, setCartToken } = useAuthStore()
  const { setCart, setRestaurantId } = useCartStore()
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['menu', CONFIG.restaurantSlug],
    queryFn: menuApi.getMenu,
    staleTime: 60_000,
  })

  const restaurant = data?.restaurant
  const categories: MenuCategory[] = data?.categories ?? []
  const currency = restaurant?.currency === 'BDT' ? '৳' : '$'

  // Set restaurantId in cart store when we get it
  React.useEffect(() => {
    if (restaurant?.id) setRestaurantId(restaurant.id)
  }, [restaurant?.id])

  const addToCartMutation = useMutation({
    mutationFn: async (item: MenuItem) => {
      if (!restaurant?.id) throw new Error('Restaurant not loaded')

      // Init cart token if not set
      let token = cartToken
      if (!token) {
        const res = await cartApi.init(restaurant.id)
        token = res.cartToken
        setCartToken(token)
      }

      // If item has required modifiers, open detail screen
      const hasRequired = item.modifierGroups?.some((g) => g.isRequired)
      if (hasRequired) {
        router.push(`/item/${item.id}` as any)
        return null
      }

      return cartApi.addItem(restaurant.id, token, {
        itemId: item.id,
        quantity: 1,
      })
    },
    onSuccess: (cart) => {
      if (cart) setCart(cart)
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? 'Could not add item to cart.')
    },
  })

  const displayedCat = activeCat ?? categories[0]?.id
  const items = categories.find((c) => c.id === displayedCat)?.items ?? []

  if (isLoading) return <LoadingScreen />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Restaurant header */}
      <View style={styles.restaurantHeader}>
        <Text style={styles.restaurantName}>{restaurant?.name ?? CONFIG.brandName}</Text>
        {restaurant?.address && (
          <Text style={styles.restaurantAddr} numberOfLines={1}>{restaurant.address}</Text>
        )}
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catBar}
        contentContainerStyle={styles.catBarContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catTab, cat.id === displayedCat && styles.catTabActive]}
            onPress={() => setActiveCat(cat.id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.catTabText, cat.id === displayedCat && styles.catTabTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            currency={currency}
            onPress={() => {
              if (item.modifierGroups && item.modifierGroups.length > 0) {
                router.push(`/item/${item.id}` as any)
              } else {
                addToCartMutation.mutate(item)
              }
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items in this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  restaurantHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  restaurantName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  restaurantAddr: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  catBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  catBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  catTabActive: { backgroundColor: COLORS.brand },
  catTabText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
  catTabTextActive: { color: COLORS.white },
  list: { padding: 16, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, color: COLORS.muted },
})
